import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * PATCH /api/routes/[id]
 *
 * Update a saved route (toggle favorite, rename origin/destination).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.route.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบเส้นทาง' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.isFavorite !== undefined) {
      updateData.isFavorite = body.isFavorite;
    }
    if (body.originName !== undefined) {
      updateData.originName = body.originName;
    }
    if (body.destinationName !== undefined) {
      updateData.destinationName = body.destinationName;
    }

    const updated = await db.route.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ route: updated });
  } catch (error) {
    console.error('[API /routes/[id] PATCH] Error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถอัปเดตเส้นทางได้' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routes/[id]
 *
 * Delete a saved route. Requires admin API key.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    // Check admin API key
    const apiKey = request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.nextUrl.searchParams.get('apiKey');

    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey && apiKey !== adminKey) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์ลบเส้นทาง กรุณาใส่รหัสแอดมิน' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existing = await db.route.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบเส้นทาง' }, { status: 404 });
    }

    await db.route.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /routes/[id] DELETE] Error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถลบเส้นทางได้' },
      { status: 500 }
    );
  }
}
