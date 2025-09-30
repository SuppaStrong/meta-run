import { NextRequest, NextResponse } from 'next/server';
import { calculateWeeklyKm, applyAdjustments, loadUsersFromFile } from '@/lib/weekly-km';
import axios from 'axios';
import * as cheerio from 'cheerio';

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

const formatDateForComparison = (dateStr: string) => {
  const datePart = dateStr.split(' ')[0];
  const [day, month, year] = datePart.split('/');
  return `${year}-${month}-${day}`;
};

const shouldContinuePagination = (lastActivityDate: string, startDate: string): boolean => {
  const lastDate = new Date(lastActivityDate);
  const targetDate = new Date(startDate);
  return lastDate >= targetDate;
};

async function scrapeWeeklyActivitiesForBannedUser(
  memberId: number,
  startDate: string,
  endDate: string
): Promise<{
  validKm: number;
  violationKm: number;
  dailyBreakdown: Map<string, { valid: number; violation: number }>;
}> {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  const dailyData = new Map<string, { valid: number; violation: number }>();
  dates.forEach(date => dailyData.set(date, { valid: 0, violation: 0 }));

  let totalValidKm = 0;
  let totalViolationKm = 0;
  let page = 1;
  let shouldContinue = true;

  while (shouldContinue) {
    try {
      const response = await axios.post(
        `https://84race.com/personal/get_data_post/activities/${memberId}`,
        `page=${page}&listCateId=`,
        {
          timeout: 15000,
          headers: {
            'accept': 'text/html, */*; q=0.01',
            'accept-language': 'vi,en-US;q=0.9,en;q=0.8',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'origin': 'https://84race.com',
            'referer': `https://84race.com/member/${memberId}`,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'x-requested-with': 'XMLHttpRequest'
          }
        }
      );

      const $ = cheerio.load(response.data);
      const posts = $('.post');

      if (posts.length === 0) {
        shouldContinue = false;
        break;
      }

      let lastActivityDate = '';

      posts.each((i, post) => {
        const timeText = $(post).find('time').text().trim();

        if (timeText) {
          const activityDate = formatDateForComparison(timeText);
          lastActivityDate = activityDate;

          if (dates.includes(activityDate)) {
            const distanceText = $(post).find('.cell').first().find('.ibl').first().text().trim();
            const kmMatch = distanceText.match(/([\d.]+)\s*km/);

            if (kmMatch) {
              const km = parseFloat(kmMatch[1]);
              const activityNameElement = $(post).find('h4.name.ellipsis');
              const hasViolation = activityNameElement.hasClass('text-danger');

              const dayData = dailyData.get(activityDate)!;
              if (hasViolation) {
                dayData.violation += km;
                totalViolationKm += km;
              } else {
                dayData.valid += km;
                totalValidKm += km;
              }
            }
          }
        }
      });

      if (lastActivityDate && !shouldContinuePagination(lastActivityDate, startDate)) {
        shouldContinue = false;
      } else if (lastActivityDate) {
        page++;
      } else {
        shouldContinue = false;
      }
    } catch (error) {
      console.error(`Error scraping banned user ${memberId} page ${page}:`, error);
      shouldContinue = false;
    }
  }

  return { validKm: totalValidKm, violationKm: totalViolationKm, dailyBreakdown: dailyData };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { startDate, endDate } = body;
    const cacheKey = `weekly_team_${startDate}_${endDate}`;

    const cached = weeklyTeamCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const users = await loadUsersFromFile();
    const regularUsers = users.filter(u => !u.ban);
    const bannedUsers = users.filter(u => u.ban === true);
    
    const memberIds = regularUsers.map(u => parseInt(u.member_id));

    let weeklyKmData = await calculateWeeklyKm(memberIds, startDate, endDate);
    
    if (bannedUsers.length > 0) {
      const dates: string[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      for (const user of bannedUsers) {
        const memberId = parseInt(user.member_id);
        const { validKm, violationKm, dailyBreakdown } = await scrapeWeeklyActivitiesForBannedUser(
          memberId,
          startDate,
          endDate
        );

        const breakdown = dates.map(date => {
          const dayData = dailyBreakdown.get(date)!;
          return {
            date,
            km: dayData.valid,
            violationKm: dayData.violation
          };
        });

        weeklyKmData.push({
          memberId,
          startDate,
          endDate,
          totalKm: validKm,
          dailyBreakdown: breakdown,
          violationKm: violationKm
        });
      }
    }

    weeklyKmData = await applyAdjustments(weeklyKmData, startDate, endDate);

    const memberKmMap = new Map<number, number>();
    weeklyKmData.forEach(data => {
      memberKmMap.set(data.memberId, data.totalKm);
    });

    const teamMap = new Map<string, {
      members: { memberId: number; memberName: string; km: number }[];
      totalKm: number;
    }>();

    users.forEach(user => {
      if (!user.team_name || user.team_name === 'null') return;

      const memberId = parseInt(user.member_id);
      const km = memberKmMap.get(memberId) || 0;
      const teamName = user.team_name;

      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, { members: [], totalKm: 0 });
      }

      const team = teamMap.get(teamName)!;
      team.members.push({ memberId, memberName: user.name, km });
      team.totalKm += km;
    });

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

    weeklyTeamCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

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