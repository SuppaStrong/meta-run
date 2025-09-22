import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cacheKey = `member_${id}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  try {
    const response = await axios.get(`https://84race.com/member/${id}`);
    const $ = cheerio.load(response.data);

    const dailyData: Array<{ date: string; km: number }> = [];
    
    $('table tbody tr').each((i, row) => {
      const dateText = $(row).find('td:nth-child(1)').text().trim();
      const kmText = $(row).find('td:nth-child(2)').text().trim();
      
      if (dateText && kmText) {
        dailyData.push({
          date: dateText,
          km: parseFloat(kmText.replace(/[^\d.]/g, '')) || 0
        });
      }
    });

    const result = {
      memberId: id,
      dailyData,
      lastUpdate: new Date().toISOString()
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}