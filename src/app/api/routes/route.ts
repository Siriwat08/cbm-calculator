import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/routes?favorite=true|false
 *
 * List all saved routes, optionally filtered to favorites only.
 * Ordered by: favorite first, then by use count, then by last used.
 */
export async function GET(request: NextRequest) {
  try {
    const favoriteOnly = request.nextUrl.searchParams.get('favorite') === 'true';

    const routes = await db.route.findMany({
      where: favoriteOnly ? { isFavorite: true } : undefined,
      orderBy: [
        { isFavorite: 'desc' },
        { useCount: 'desc' },
        { lastUsedAt: 'desc' },
      ],
    });

    return NextResponse.json({ routes });
  } catch (error) {
    console.error('[API /routes] Error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถโหลดข้อมูลเส้นทางได้' },
      { status: 500 }
    );
  }
}
