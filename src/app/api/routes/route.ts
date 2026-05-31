import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const favoriteOnly = request.nextUrl.searchParams.get('favorite') === 'true';

    const whereClause = favoriteOnly ? 'WHERE "isFavorite" = true' : '';
    const routes = await db.$queryRawUnsafe(`
      SELECT * FROM "routes"
      ${whereClause}
      ORDER BY "isFavorite" DESC, "useCount" DESC, "lastUsedAt" DESC
    `) as any[];

    return NextResponse.json({ routes });
  } catch (error) {
    console.error('[API /routes] Error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถโหลดข้อมูลเส้นทางได้' },
      { status: 500 }
    );
  }
}
