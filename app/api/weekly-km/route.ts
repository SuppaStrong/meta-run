import { NextRequest, NextResponse } from 'next/server';
import { calculateWeeklyKm, applyAdjustments, WeeklyMemberKm } from '@/lib/weekly-km';

const weeklyCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000;

interface CacheEntry {
  data: WeeklyMemberKm[];
  timestamp: number;
}

interface RequestBody {
  memberIds: number[];
  startDate: string;
  endDate: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const { memberIds, startDate, endDate } = body;
    const cacheKey = `weekly_${startDate}_${endDate}`;

    // Check cache
    const cached = weeklyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached weekly data');
      return NextResponse.json(cached.data);
    }

    console.log(`Fetching weekly km for ${memberIds.length} members`);

    // ✅ Use shared logic
    let results = await calculateWeeklyKm(memberIds, startDate, endDate);
    
    // Apply adjustments
    results = await applyAdjustments(results, startDate, endDate);

    // Sort by totalKm
    results.sort((a, b) => b.totalKm - a.totalKm);

    // Cache results
    weeklyCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

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