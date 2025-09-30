import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export interface KmAdjustment {
  id: string;
  bibNumber: number;
  date: string;
  adjustmentKm: number;
  reason: string;
  createdAt: string;
}

// Đường dẫn đến file JSON trong public/data
const ADJUSTMENTS_FILE = path.join(process.cwd(), 'public', 'data', 'adjustments.json');

/**
 * Đọc adjustments từ file JSON
 */
async function readAdjustments(): Promise<KmAdjustment[]> {
  try {
    // Đảm bảo folder tồn tại
    const dir = path.dirname(ADJUSTMENTS_FILE);
    await fs.mkdir(dir, { recursive: true });

    // Đọc file
    const data = await fs.readFile(ADJUSTMENTS_FILE, 'utf8');
    const adjustments = JSON.parse(data);
    
    console.log(`[readAdjustments] Successfully read ${adjustments.length} adjustments`);
    return adjustments;
  } catch (error) {
    // Nếu file chưa tồn tại hoặc lỗi, trả về mảng rỗng
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('[readAdjustments] File not found, returning empty array');
      return [];
    }
    console.error('[readAdjustments] Error:', error);
    return [];
  }
}

/**
 * Ghi adjustments vào file JSON
 */
async function writeAdjustments(adjustments: KmAdjustment[]): Promise<void> {
  try {
    // Đảm bảo folder tồn tại
    const dir = path.dirname(ADJUSTMENTS_FILE);
    await fs.mkdir(dir, { recursive: true });

    // Ghi file với format đẹp
    await fs.writeFile(
      ADJUSTMENTS_FILE, 
      JSON.stringify(adjustments, null, 2),
      'utf8'
    );
    
    console.log(`[writeAdjustments] Successfully wrote ${adjustments.length} adjustments`);
  } catch (error) {
    console.error('[writeAdjustments] Error:', error);
    throw error;
  }
}

/**
 * GET - Lấy danh sách adjustments
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const bibNumber = searchParams.get('bibNumber');

    // Đọc tất cả adjustments - DÙNG CONST thay vì LET
    const adjustments = await readAdjustments();
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

    // Đọc adjustments hiện tại
    const adjustments = await readAdjustments();

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
    
    // Ghi vào file
    await writeAdjustments(adjustments);

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

    // Đọc adjustments hiện tại
    let adjustments = await readAdjustments();
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

    // Ghi lại vào file
    await writeAdjustments(adjustments);

    console.log(`[DELETE] Deleted successfully. Total count: ${adjustments.length}`);
    return NextResponse.json({ success: true, message: 'Adjustment deleted' });
  } catch (error) {
    console.error('[DELETE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}