import { NextRequest, NextResponse } from 'next/server';

export interface KmAdjustment {
  id: string;
  bibNumber: number;
  date: string;
  adjustmentKm: number;
  reason: string;
  createdAt: string;
}

// In-memory storage (sẽ mất khi restart server)
// Trong production, nên dùng database
let adjustments: KmAdjustment[] = [];

// GET - Lấy tất cả adjustments
export async function GET(request: NextRequest) {
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

  return NextResponse.json(filtered);
}

// POST - Thêm adjustment mới
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bibNumber, date, adjustmentKm, reason } = body;

    if (!bibNumber || !date || adjustmentKm === undefined) {
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

    return NextResponse.json(newAdjustment);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Xóa adjustment
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing adjustment ID' },
        { status: 400 }
      );
    }

    const initialLength = adjustments.length;
    adjustments = adjustments.filter(adj => adj.id !== id);

    if (adjustments.length === initialLength) {
      return NextResponse.json(
        { error: 'Adjustment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}