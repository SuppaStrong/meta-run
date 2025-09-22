import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

const dailyCache = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const { memberIds, date } = await request.json();
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `daily_${targetDate}`;

    if (dailyCache.has(cacheKey)) {
      return NextResponse.json(dailyCache.get(cacheKey));
    }

    const results = await Promise.all(
      memberIds.map(async (memberId: number) => {
        try {
          const response = await axios.get(`https://84race.com/member/${memberId}`);
          const $ = cheerio.load(response.data);
          
          let kmForDate = 0;
          
          $('table tbody tr').each((i, row) => {
            const rowDate = $(row).find('td:nth-child(1)').text().trim();
            if (rowDate === targetDate) {
              const kmText = $(row).find('td:nth-child(2)').text().trim();
              kmForDate = parseFloat(kmText.replace(/[^\d.]/g, '')) || 0;
            }
          });

          return {
            memberId,
            date: targetDate,
            km: kmForDate
          };
        } catch (error) {
          return {
            memberId,
            date: targetDate,
            km: 0
          };
        }
      })
    );

    results.sort((a, b) => b.km - a.km);
    dailyCache.set(cacheKey, results);

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}