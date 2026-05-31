import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if route exists
    const existing = await db.$queryRawUnsafe(`SELECT id FROM "routes" WHERE "id" = '${id}'`) as any[];
    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'ไม่พบเส้นทาง' }, { status: 404 });
    }

    const setClauses: string[] = ['"updatedAt" = CURRENT_TIMESTAMP'];

    if (body.isFavorite !== undefined) {
      setClauses.push(`"isFavorite" = ${body.isFavorite ? 'true' : 'false'}`);
    }
    if (body.originName !== undefined) {
      setClauses.push(`"originName" = '${body.originName.replace(/'/g, "''")}'`);
    }
    if (body.destinationName !== undefined) {
      setClauses.push(`"destinationName" = '${body.destinationName.replace(/'/g, "''")}'`);
    }

    await db.$executeRawUnsafe(`
      UPDATE "routes" SET ${setClauses.join(', ')} WHERE "id" = '${id}'
    `);

    const updated = await db.$queryRawUnsafe(`SELECT * FROM "routes" WHERE "id" = '${id}'`) as any[];

    return NextResponse.json({ route: updated?.[0] || null });
  } catch (error) {
    console.error('[API /routes/[id] PATCH] Error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถอัปเดตเส้นทางได้' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const existing = await db.$queryRawUnsafe(`SELECT id FROM "routes" WHERE "id" = '${id}'`) as any[];
    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'ไม่พบเส้นทาง' }, { status: 404 });
    }

    await db.$executeRawUnsafe(`DELETE FROM "routes" WHERE "id" = '${id}'`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /routes/[id] DELETE] Error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถลบเส้นทางได้' },
      { status: 500 }
    );
  }
}
