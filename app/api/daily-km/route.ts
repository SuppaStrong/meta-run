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
}

interface RequestBody {
  memberIds: number[];
  date?: string;
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
          console.log(`Scraping member ${memberId}...`);
          const response = await axios.get(`https://84race.com/member/${memberId}`, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          const $ = cheerio.load(response.data);
          let kmForDate = 0;
          
          // Parse date format: "22/09/2025 07:47:41 (GMT+7)"
          const formatDateForComparison = (dateStr: string) => {
            // Extract just the date part before the time
            const datePart = dateStr.split(' ')[0]; // "22/09/2025"
            const [day, month, year] = datePart.split('/');
            return `${year}-${month}-${day}`; // Convert to "2025-09-22" format
          };

          // Find all activity posts
          $('.post').each((i, post) => {
            const timeText = $(post).find('time').text().trim();
            
            if (timeText) {
              const activityDate = formatDateForComparison(timeText);
              
              if (activityDate === targetDate) {
                // Find the distance cell
                const distanceText = $(post).find('.cell').first().find('.ibl').first().text().trim();
                const kmMatch = distanceText.match(/([\d.]+)\s*km/);
                
                if (kmMatch) {
                  const km = parseFloat(kmMatch[1]);
                  kmForDate += km;
                  console.log(`Member ${memberId}: Found ${km} km on ${activityDate}`);
                }
              }
            }
          });

          console.log(`Member ${memberId}: Total ${kmForDate} km on ${targetDate}`);

          return {
            memberId,
            date: targetDate,
            km: kmForDate
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error fetching member ${memberId}:`, errorMessage);
          return {
            memberId,
            date: targetDate,
            km: 0
          };
        }
      })
    );

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