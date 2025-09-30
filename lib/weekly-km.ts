import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

interface DailyBreakdown {
  date: string;
  km: number;
  violationKm: number;
}

export interface WeeklyMemberKm {
  memberId: number;
  startDate: string;
  endDate: string;
  totalKm: number;
  adjustmentKm?: number;
  violationKm?: number;
  dailyBreakdown: DailyBreakdown[];
}

export interface UserData {
  name: string;
  member_id: string;
  team_name?: string;
  gender: string;
  strava_id?: string;
  ban?: boolean;
}

interface KmAdjustment {
  bibNumber: number;
  adjustmentKm: number;
  date: string;
  reason?: string;
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

async function scrapeActivitiesWithPagination(
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
      console.error(`Error scraping member ${memberId} page ${page}:`, error);
      shouldContinue = false;
    }
  }

  return { validKm: totalValidKm, violationKm: totalViolationKm, dailyBreakdown: dailyData };
}

export async function scrapeTotalKmForBannedUser(memberId: number): Promise<number> {
  let totalValidKm = 0;
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

      posts.each((i, post) => {
        const distanceText = $(post).find('.cell').first().find('.ibl').first().text().trim();
        const kmMatch = distanceText.match(/([\d.]+)\s*km/);

        if (kmMatch) {
          const km = parseFloat(kmMatch[1]);
          const activityNameElement = $(post).find('h4.name.ellipsis');
          const hasViolation = activityNameElement.hasClass('text-danger');

          if (!hasViolation) {
            totalValidKm += km;
          }
        }
      });

      page++;
      if (page > 50) shouldContinue = false;
    } catch (error) {
      console.error(`Error scraping banned user ${memberId} page ${page}:`, error);
      shouldContinue = false;
    }
  }

  return totalValidKm;
}

export async function calculateWeeklyKm(
  memberIds: number[],
  startDate: string,
  endDate: string
): Promise<WeeklyMemberKm[]> {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  const results = await Promise.all(
    memberIds.map(async (memberId: number): Promise<WeeklyMemberKm> => {
      try {
        const { validKm, violationKm, dailyBreakdown } = await scrapeActivitiesWithPagination(
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

        return {
          memberId,
          startDate,
          endDate,
          totalKm: validKm,
          dailyBreakdown: breakdown,
          violationKm: violationKm
        };
      } catch (error) {
        console.error(`Error fetching member ${memberId}:`, error);
        return {
          memberId,
          startDate,
          endDate,
          totalKm: 0,
          dailyBreakdown: dates.map(date => ({ date, km: 0, violationKm: 0 })),
          violationKm: 0
        };
      }
    })
  );

  return results;
}

export async function loadUsersFromFile(): Promise<UserData[]> {
  const filePath = path.join(process.cwd(), 'public', 'user.json');
  const fileContents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
}

export async function applyAdjustments(
  results: WeeklyMemberKm[],
  startDate: string,
  endDate: string
): Promise<WeeklyMemberKm[]> {
  try {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const baseUrl = getBaseUrl();
    
    const adjustmentPromises = dates.map(date =>
      fetch(`${baseUrl}/api/km-adjustments?date=${date}`, { cache: 'no-store' })
    );

    const adjustmentResponses = await Promise.all(adjustmentPromises);
    const allAdjustments: KmAdjustment[] = [];

    for (const response of adjustmentResponses) {
      if (response.ok) {
        const adjustments: KmAdjustment[] = await response.json();
        allAdjustments.push(...adjustments);
      }
    }

    const memberAdjustments = new Map<number, number>();
    allAdjustments.forEach(adj => {
      const current = memberAdjustments.get(adj.bibNumber) || 0;
      memberAdjustments.set(adj.bibNumber, current + adj.adjustmentKm);
    });

    results.forEach(result => {
      const adjustment = memberAdjustments.get(result.memberId);
      if (adjustment) {
        result.adjustmentKm = adjustment;
        result.totalKm = Math.max(0, result.totalKm + adjustment);
      }
    });
  } catch (error) {
    console.error('Error applying adjustments:', error);
  }

  return results;
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  return 'http://localhost:3000';
}