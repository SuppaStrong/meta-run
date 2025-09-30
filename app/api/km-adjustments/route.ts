import { NextRequest, NextResponse } from 'next/server';

export interface KmAdjustment {
  id: string;
  bibNumber: number;
  date: string;
  adjustmentKm: number;
  reason: string;
  createdAt: string;
}

let adjustments: KmAdjustment[] = [];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const bibNumber = searchParams.get('bibNumber');

    let filtered = adjustments;

    if (date) {
      filtered = filtered.filter(adj => adj.date === date);
    }

    if (bibNumber) {
      filtered = filtered.filter(adj => adj.bibNumber === parseInt(bibNumber));
    }

    console.log(`[KM Adjustments GET] Returning ${filtered.length} adjustments (total: ${adjustments.length})`);
    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[KM Adjustments GET] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bibNumber, date, adjustmentKm, reason } = body;

    console.log('[KM Adjustments POST] Received:', { bibNumber, date, adjustmentKm, reason });

    if (!bibNumber || !date || adjustmentKm === undefined) {
      console.error('[KM Adjustments POST] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newAdjustment: KmAdjustment = {
      id: `${bibNumber}-${date}-${Date.now()}`,
      bibNumber: parseInt(bibNumber),
      date,
      adjustmentKm: parseFloat(adjustmentKm),
      reason: reason || '',
      createdAt: new Date().toISOString()
    };

    adjustments.push(newAdjustment);
    console.log(`[KM Adjustments POST] Added adjustment. Total count: ${adjustments.length}`);

    return NextResponse.json(newAdjustment);
  } catch (error) {
    console.error('[KM Adjustments POST] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    console.log('[KM Adjustments DELETE] Deleting ID:', id);

    if (!id) {
      return NextResponse.json(
        { error: 'Missing adjustment ID' },
        { status: 400 }
      );
    }

    const initialLength = adjustments.length;
    adjustments = adjustments.filter(adj => adj.id !== id);

    if (adjustments.length === initialLength) {
      console.error('[KM Adjustments DELETE] Adjustment not found');
      return NextResponse.json(
        { error: 'Adjustment not found' },
        { status: 404 }
      );
    }

    console.log(`[KM Adjustments DELETE] Deleted. Total count: ${adjustments.length}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[KM Adjustments DELETE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}