import { NextRequest, NextResponse } from 'next/server';
import { geocode } from '@/lib/ors-api';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await geocode(query.trim());
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[API /geocode] Error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถค้นหาสถานที่ได้' },
      { status: 500 }
    );
  }
}
