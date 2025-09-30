import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { loadUsersFromFile, UserData } from '@/lib/weekly-km';

const dailyCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000;

interface CacheEntry {
  data: DailyKmResult[];
  timestamp: number;
}

interface DailyKmResult {
  memberId: number;
  date: string;
  km: number;
  originalKm?: number;
  adjustmentKm?: number;
  violationKm?: number;
}

interface RequestBody {
  memberIds: number[];
  date?: string;
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

const shouldContinuePagination = (lastActivityDate: string, targetDate: string): boolean => {
  const lastDate = new Date(lastActivityDate);
  const target = new Date(targetDate);
  return lastDate >= target;
};

async function scrapeActivitiesForDate(
  memberId: number, 
  targetDate: string
): Promise<{ validKm: number; violationKm: number }> {
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
          timeout: 10000,
          headers: {
            'accept': 'text/html, */*; q=0.01',
            'accept-language': 'vi,en-US;q=0.9,en;q=0.8',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'origin': 'https://84race.com',
            'referer': `https://84race.com/member/${memberId}`,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
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
          
          if (activityDate === targetDate) {
            const distanceText = $(post).find('.cell').first().find('.ibl').first().text().trim();
            const kmMatch = distanceText.match(/([\d.]+)\s*km/);
            
            if (kmMatch) {
              const km = parseFloat(kmMatch[1]);
              const activityNameElement = $(post).find('h4.name.ellipsis');
              const hasViolation = activityNameElement.hasClass('text-danger');
              
              if (hasViolation) {
                totalViolationKm += km;
              } else {
                totalValidKm += km;
              }
            }
          }
        }
      });

      if (lastActivityDate && !shouldContinuePagination(lastActivityDate, targetDate)) {
        shouldContinue = false;
      } else if (lastActivityDate) {
        page++;
      } else {
        shouldContinue = false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error scraping member ${memberId} page ${page}:`, errorMessage);
      shouldContinue = false;
    }
  }

  return {
    validKm: totalValidKm,
    violationKm: totalViolationKm
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { memberIds, date } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `daily_${targetDate}`;

    const cached = dailyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const results = await Promise.all(
      memberIds.map(async (memberId: number): Promise<DailyKmResult> => {
        try {
          const { validKm, violationKm } = await scrapeActivitiesForDate(memberId, targetDate);

          return {
            memberId,
            date: targetDate,
            km: validKm,
            originalKm: validKm,
            violationKm: violationKm
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error fetching member ${memberId}:`, errorMessage);
          return {
            memberId,
            date: targetDate,
            km: 0,
            originalKm: 0,
            violationKm: 0
          };
        }
      })
    );

    try {
      const users: UserData[] = await loadUsersFromFile();
      const bannedUsers = users.filter(u => u.ban === true);

      if (bannedUsers.length > 0) {
        for (const user of bannedUsers) {
          const memberId = parseInt(user.member_id);
          const { validKm, violationKm } = await scrapeActivitiesForDate(memberId, targetDate);
          
          results.push({
            memberId,
            date: targetDate,
            km: validKm,
            originalKm: validKm,
            violationKm: violationKm
          });
        }
      }
    } catch (error) {
      console.error('Error adding banned users to daily rankings:', error);
    }

    try {
      const adjustmentsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/km-adjustments?date=${targetDate}`,
        { cache: 'no-store' }
      );
      
      if (adjustmentsResponse.ok) {
        const adjustments: KmAdjustment[] = await adjustmentsResponse.json();
        console.log(`[Daily] Loaded ${adjustments.length} adjustments for date ${targetDate}`);
        
        results.forEach(result => {
          const adjustment = adjustments.find(
            (adj) => adj.bibNumber === result.memberId
          );
          
          if (adjustment) {
            result.adjustmentKm = adjustment.adjustmentKm;
            result.km = Math.max(0, result.originalKm! + adjustment.adjustmentKm);
            console.log(`[Daily] Applied adjustment to BIB ${result.memberId}: ${result.originalKm} + (${adjustment.adjustmentKm}) = ${result.km}`);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }

    results.sort((a, b) => b.km - a.km);
    
    dailyCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    return NextResponse.json(results);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in daily-km API:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}