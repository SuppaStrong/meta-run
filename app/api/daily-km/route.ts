import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

const dailyCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

// Helper function to parse date from activity
const formatDateForComparison = (dateStr: string) => {
  const datePart = dateStr.split(' ')[0];
  const [day, month, year] = datePart.split('/');
  return `${year}-${month}-${day}`;
};

// Helper function to check if we should continue pagination
const shouldContinuePagination = (lastActivityDate: string, targetDate: string): boolean => {
  const lastDate = new Date(lastActivityDate);
  const target = new Date(targetDate);
  return lastDate >= target;
};

// Function to scrape activities with pagination for a specific date
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
      console.log(`Scraping member ${memberId} page ${page} for date ${targetDate}...`);
      
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
          
          if (activityDate === targetDate) {
            const distanceText = $(post).find('.cell').first().find('.ibl').first().text().trim();
            const kmMatch = distanceText.match(/([\d.]+)\s*km/);
            
            if (kmMatch) {
              const km = parseFloat(kmMatch[1]);
              const activityNameElement = $(post).find('h4.name.ellipsis');
              const hasViolation = activityNameElement.hasClass('text-danger');
              
              if (hasViolation) {
                totalViolationKm += km;
                console.log(`Member ${memberId}: Found VIOLATION ${km} km on ${activityDate} - NOT COUNTED`);
              } else {
                totalValidKm += km;
                console.log(`Member ${memberId}: Found ${km} km on ${activityDate}`);
              }
            }
          }
        }
      });

      // Check if we should continue to next page
      if (lastActivityDate && !shouldContinuePagination(lastActivityDate, targetDate)) {
        console.log(`Member ${memberId}: Last activity date ${lastActivityDate} is before target date ${targetDate}, stopping pagination`);
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

  console.log(`Member ${memberId}: Scraped ${page} pages, Total VALID ${totalValidKm} km, VIOLATION ${totalViolationKm} km on ${targetDate}`);

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

    // Check cache
    const cached = dailyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached data for', targetDate);
      return NextResponse.json(cached.data);
    }

    console.log(`Fetching daily km for ${memberIds.length} members on ${targetDate}`);

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

    // Fetch adjustments for this date
    try {
      const adjustmentsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/km-adjustments?date=${targetDate}`,
        { cache: 'no-store' }
      );
      
      if (adjustmentsResponse.ok) {
        const adjustments: KmAdjustment[] = await adjustmentsResponse.json();
        
        results.forEach(result => {
          const adjustment = adjustments.find(
            (adj) => adj.bibNumber === result.memberId
          );
          
          if (adjustment) {
            result.adjustmentKm = adjustment.adjustmentKm;
            result.km = Math.max(0, result.originalKm! + adjustment.adjustmentKm);
            console.log(`Applied adjustment to member ${result.memberId}: ${adjustment.adjustmentKm} km`);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }

    // Sort by km descending
    results.sort((a, b) => b.km - a.km);
    
    // Cache the results
    dailyCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    console.log(`Successfully fetched data for ${results.length} members`);
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