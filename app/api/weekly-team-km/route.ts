import { NextRequest, NextResponse } from 'next/server';
import { calculateWeeklyKm, applyAdjustments, loadUsersFromFile } from '@/lib/weekly-km';

const weeklyTeamCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000;

interface CacheEntry {
  data: WeeklyTeamResult[];
  timestamp: number;
}

interface WeeklyTeamResult {
  teamName: string;
  totalKm: number;
  memberCount: number;
  avgKm: number;
  members: {
    memberId: number;
    memberName: string;
    km: number;
  }[];
  startDate: string;
  endDate: string;
}

interface RequestBody {
  startDate: string;
  endDate: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { startDate, endDate } = body;
    const cacheKey = `weekly_team_${startDate}_${endDate}`;

    // Check cache
    const cached = weeklyTeamCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached weekly team data');
      return NextResponse.json(cached.data);
    }

    console.log(`Calculating weekly team km from ${startDate} to ${endDate}`);

    // ✅ Load users directly from file system
    const users = await loadUsersFromFile();
    const memberIds = users.map(u => parseInt(u.member_id));

    // ✅ Calculate weekly km using shared logic
    let weeklyKmData = await calculateWeeklyKm(memberIds, startDate, endDate);
    
    // Apply adjustments
    weeklyKmData = await applyAdjustments(weeklyKmData, startDate, endDate);

    // Create member km map
    const memberKmMap = new Map<number, number>();
    weeklyKmData.forEach(data => {
      memberKmMap.set(data.memberId, data.totalKm);
    });

    // Group by team
    const teamMap = new Map<string, {
      members: { memberId: number; memberName: string; km: number }[];
      totalKm: number;
    }>();

    users.forEach(user => {
      const memberId = parseInt(user.member_id);
      const km = memberKmMap.get(memberId) || 0;
      const teamName = user.team_name || 'No Team';

      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, { members: [], totalKm: 0 });
      }

      const team = teamMap.get(teamName)!;
      team.members.push({ memberId, memberName: user.name, km });
      team.totalKm += km;
    });

    // Convert to results array
    const results: WeeklyTeamResult[] = [];
    teamMap.forEach((teamData, teamName) => {
      results.push({
        teamName,
        totalKm: teamData.totalKm,
        memberCount: teamData.members.length,
        avgKm: teamData.totalKm / teamData.members.length,
        members: teamData.members.sort((a, b) => b.km - a.km),
        startDate,
        endDate
      });
    });

    results.sort((a, b) => b.totalKm - a.totalKm);

    // Cache results
    weeklyTeamCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    console.log(`Successfully calculated ${results.length} teams`);
    return NextResponse.json(results);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in weekly-team-km API:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}