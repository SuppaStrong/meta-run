import { NextRequest, NextResponse } from 'next/server';

const weeklyTeamCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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
  startDate: string; // Monday
  endDate: string;   // Sunday
}

interface UserData {
  name: string;
  member_id: string;
  team_name?: string;
}

interface WeeklyMemberKm {
  memberId: number;
  totalKm: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { startDate, endDate } = body;
    const cacheKey = `weekly_team_${startDate}_${endDate}`;

    // Check cache
    const cached = weeklyTeamCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached weekly team data for', startDate, 'to', endDate);
      return NextResponse.json(cached.data);
    }

    console.log(`Fetching weekly team km from ${startDate} to ${endDate}`);

    // Load user.json to get team mappings
    const usersResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/user.json`,
      { cache: 'no-store' }
    );
    
    if (!usersResponse.ok) {
      throw new Error('Failed to load user data');
    }

    const users: UserData[] = await usersResponse.json();
    
    // Get all member IDs
    const memberIds = users.map(u => parseInt(u.member_id));

    // Fetch weekly km for all members
    const weeklyKmResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/weekly-km`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds, startDate, endDate }),
        cache: 'no-store'
      }
    );

    if (!weeklyKmResponse.ok) {
      throw new Error('Failed to fetch weekly km data');
    }

    const weeklyKmData: WeeklyMemberKm[] = await weeklyKmResponse.json();

    // Create a map of memberId -> km
    const memberKmMap = new Map<number, number>();
    weeklyKmData.forEach(data => {
      memberKmMap.set(data.memberId, data.totalKm);
    });

    // Group members by team
    const teamMap = new Map<string, {
      members: { memberId: number; memberName: string; km: number }[];
      totalKm: number;
    }>();

    users.forEach(user => {
      const memberId = parseInt(user.member_id);
      const km = memberKmMap.get(memberId) || 0;
      const teamName = user.team_name || 'No Team';

      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, {
          members: [],
          totalKm: 0
        });
      }

      const team = teamMap.get(teamName)!;
      team.members.push({
        memberId,
        memberName: user.name,
        km
      });
      team.totalKm += km;
    });

    // Convert to array and calculate stats
    const results: WeeklyTeamResult[] = [];
    teamMap.forEach((teamData, teamName) => {
      results.push({
        teamName,
        totalKm: teamData.totalKm,
        memberCount: teamData.members.length,
        avgKm: teamData.totalKm / teamData.members.length,
        members: teamData.members.sort((a, b) => b.km - a.km), // Sort members by km descending
        startDate,
        endDate
      });
    });

    // Sort teams by totalKm descending
    results.sort((a, b) => b.totalKm - a.totalKm);

    // Cache the results
    weeklyTeamCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    console.log(`Successfully calculated weekly team rankings for ${results.length} teams`);
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