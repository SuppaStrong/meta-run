import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface CacheEntry {
  data: MemberData;
  timestamp: number;
}

interface DailyData {
  date: string;
  km: number;
}

interface MemberData {
  memberId: string;
  dailyData: DailyData[];
  lastUpdate: string;
}

const cache = new Map<string, CacheEntry>();
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

    const dailyData: DailyData[] = [];
    
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

    const result: MemberData = {
      memberId: id,
      dailyData,
      lastUpdate: new Date().toISOString()
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}