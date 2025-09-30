import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv'; // ← Đổi từ '@vercel/kv' thành '@/lib/kv'

export interface KmAdjustment {
  id: string;
  bibNumber: number;
  date: string;
  adjustmentKm: number;
  reason: string;
  createdAt: string;
}

// Key để lưu trong KV store
const ADJUSTMENTS_KEY = 'km_adjustments';

/**
 * GET - Lấy danh sách adjustments
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const bibNumber = searchParams.get('bibNumber');

    // Đọc từ KV store
    const adjustments: KmAdjustment[] = await kv.get(ADJUSTMENTS_KEY) || [];
    let filtered = adjustments;

    // Filter theo date nếu có
    if (date) {
      filtered = filtered.filter(adj => adj.date === date);
      console.log(`[GET] Filtered by date ${date}: ${filtered.length} results`);
    }

    // Filter theo bibNumber nếu có
    if (bibNumber) {
      filtered = filtered.filter(adj => adj.bibNumber === parseInt(bibNumber));
      console.log(`[GET] Filtered by bibNumber ${bibNumber}: ${filtered.length} results`);
    }

    console.log(`[GET] Returning ${filtered.length} adjustments (total: ${adjustments.length})`);
    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[GET] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST - Thêm adjustment mới
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bibNumber, date, adjustmentKm, reason } = body;

    console.log('[POST] Received:', { bibNumber, date, adjustmentKm, reason });

    // Validate dữ liệu
    if (!bibNumber || !date || adjustmentKm === undefined) {
      console.error('[POST] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: bibNumber, date, adjustmentKm' },
        { status: 400 }
      );
    }

    // Đọc adjustments hiện tại từ KV
    const adjustments: KmAdjustment[] = await kv.get(ADJUSTMENTS_KEY) || [];

    // Tạo adjustment mới
    const newAdjustment: KmAdjustment = {
      id: `${bibNumber}-${date}-${Date.now()}`,
      bibNumber: parseInt(bibNumber),
      date,
      adjustmentKm: parseFloat(adjustmentKm),
      reason: reason || '',
      createdAt: new Date().toISOString()
    };

    // Thêm vào mảng
    adjustments.push(newAdjustment);
    
    // Ghi vào KV store
    await kv.set(ADJUSTMENTS_KEY, adjustments);

    console.log(`[POST] Added adjustment. Total count: ${adjustments.length}`);
    console.log('[POST] New adjustment:', newAdjustment);

    return NextResponse.json(newAdjustment, { status: 201 });
  } catch (error) {
    console.error('[POST] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE - Xóa adjustment
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    console.log('[DELETE] Deleting ID:', id);

    if (!id) {
      return NextResponse.json(
        { error: 'Missing adjustment ID' },
        { status: 400 }
      );
    }

    // Đọc adjustments hiện tại từ KV
    let adjustments: KmAdjustment[] = await kv.get(ADJUSTMENTS_KEY) || [];
    const initialLength = adjustments.length;

    // Lọc bỏ adjustment cần xóa
    adjustments = adjustments.filter(adj => adj.id !== id);

    // Kiểm tra có xóa được không
    if (adjustments.length === initialLength) {
      console.error('[DELETE] Adjustment not found:', id);
      return NextResponse.json(
        { error: 'Adjustment not found' },
        { status: 404 }
      );
    }

    // Ghi lại vào KV store
    await kv.set(ADJUSTMENTS_KEY, adjustments);

    console.log(`[DELETE] Deleted successfully. Total count: ${adjustments.length}`);
    return NextResponse.json({ success: true, message: 'Adjustment deleted' });
  } catch (error) {
    console.error('[DELETE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}