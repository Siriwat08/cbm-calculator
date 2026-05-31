import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { validateApiKey } from '@/lib/oil-price-api';

// ===== GET: Get quotation by ID =====
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const quotation = await db.quotation.findUnique({
      where: { id },
      include: {
        trips: {
          orderBy: { tripIndex: 'asc' },
          include: { items: { orderBy: { itemIndex: 'asc' } } },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'ไม่พบใบเสนอราคา' }, { status: 404 });
    }

    return NextResponse.json({ quotation });
  } catch (error) {
    console.error('[Quotation] GET error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// ===== PATCH: Update quotation status =====
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 401 });
  }

  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const { status, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status.toUpperCase();
    if (notes !== undefined) updateData.notes = notes;

    const quotation = await db.quotation.update({
      where: { id },
      data: updateData,
      include: {
        trips: {
          orderBy: { tripIndex: 'asc' },
          include: { items: { orderBy: { itemIndex: 'asc' } } },
        },
      },
    });

    return NextResponse.json({ success: true, quotation });
  } catch (error) {
    console.error('[Quotation] PATCH error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}

// ===== DELETE: Delete quotation =====
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 401 });
  }

  try {
    const db = getDb();
    const { id } = await params;

    await db.quotation.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'ลบใบเสนอราคาเรียบร้อย' });
  } catch (error) {
    console.error('[Quotation] DELETE error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบได้' }, { status: 500 });
  }
}
