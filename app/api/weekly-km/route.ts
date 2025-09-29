import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

const weeklyCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  data: WeeklyKmResult[];
  timestamp: number;
}

interface WeeklyKmResult {
  memberId: number;
  startDate: string;
  endDate: string;
  totalKm: number;
  dailyBreakdown: {
    date: string;
    km: number;
    violationKm: number;
  }[];
  adjustmentKm?: number;
  violationKm?: number;
}

interface RequestBody {
  memberIds: number[];
  startDate: string; // Monday
  endDate: string;   // Sunday
}

interface KmAdjustment {
  bibNumber: number;
  adjustmentKm: number;
  date: string;
  reason?: string;
}

// Helper function to parse date from activity
const formatDateForComparison = (dateStr: string) => {
  const datePart = dateStr.split(' ')[0];
  const [day, month, year] = datePart.split('/');
  return `${year}-${month}-${day}`;
};

// Helper function to check if we should continue pagination
const shouldContinuePagination = (lastActivityDate: string, startDate: string): boolean => {
  const lastDate = new Date(lastActivityDate);
  const targetDate = new Date(startDate);
  return lastDate >= targetDate;
};

// Function to scrape activities with pagination
async function scrapeActivitiesWithPagination(
  memberId: number, 
  startDate: string, 
  endDate: string
): Promise<{ validKm: number; violationKm: number; dailyBreakdown: Map<string, { valid: number; violation: number }> }> {
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
      console.log(`Scraping member ${memberId} page ${page}...`);
      
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
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'x-requested-with': 'XMLHttpRequest'
          }
        }
      );

      const $ = cheerio.load(response.data);
      const posts = $('.post');
      
      if (posts.length === 0) {
        console.log(`Member ${memberId}: No more activities on page ${page}`);
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

      // Check if we should continue to next page
      if (lastActivityDate && !shouldContinuePagination(lastActivityDate, startDate)) {
        console.log(`Member ${memberId}: Last activity date ${lastActivityDate} is before start date ${startDate}, stopping pagination`);
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

  console.log(`Member ${memberId}: Scraped ${page} pages, Total VALID ${totalValidKm} km, VIOLATION ${totalViolationKm} km`);

  return {
    validKm: totalValidKm,
    violationKm: totalViolationKm,
    dailyBreakdown: dailyData
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { memberIds, startDate, endDate } = body;
    const cacheKey = `weekly_${startDate}_${endDate}`;

    // Check cache
    const cached = weeklyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached weekly data for', startDate, 'to', endDate);
      return NextResponse.json(cached.data);
    }

    console.log(`Fetching weekly km for ${memberIds.length} members from ${startDate} to ${endDate}`);

    // Generate array of dates in the week
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const results = await Promise.all(
      memberIds.map(async (memberId: number): Promise<WeeklyKmResult> => {
        try {
          const { validKm, violationKm, dailyBreakdown } = await scrapeActivitiesWithPagination(
            memberId,
            startDate,
            endDate
          );

          // Convert map to array
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error fetching member ${memberId}:`, errorMessage);
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

    // Fetch adjustments for the week
    try {
      const adjustmentPromises = dates.map(date =>
        fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/km-adjustments?date=${date}`,
          { cache: 'no-store' }
        )
      );
      
      const adjustmentResponses = await Promise.all(adjustmentPromises);
      const allAdjustments: KmAdjustment[] = [];
      
      for (const response of adjustmentResponses) {
        if (response.ok) {
          const adjustments: KmAdjustment[] = await response.json();
          allAdjustments.push(...adjustments);
        }
      }
      
      // Group adjustments by member
      const memberAdjustments = new Map<number, number>();
      allAdjustments.forEach(adj => {
        const current = memberAdjustments.get(adj.bibNumber) || 0;
        memberAdjustments.set(adj.bibNumber, current + adj.adjustmentKm);
      });
      
      // Apply adjustments
      results.forEach(result => {
        const adjustment = memberAdjustments.get(result.memberId);
        if (adjustment) {
          result.adjustmentKm = adjustment;
          result.totalKm = Math.max(0, result.totalKm + adjustment);
          console.log(`Applied weekly adjustment to member ${result.memberId}: ${adjustment} km`);
        }
      });
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }

    // Sort by totalKm descending
    results.sort((a, b) => b.totalKm - a.totalKm);
    
    // Cache the results
    weeklyCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    console.log(`Successfully fetched weekly data for ${results.length} members`);
    return NextResponse.json(results);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in weekly-km API:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}