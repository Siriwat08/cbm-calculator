import { NextRequest, NextResponse } from 'next/server';
import { geocode, getRoute } from '@/lib/ors-api';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const originText = request.nextUrl.searchParams.get('origin');
  const destinationText = request.nextUrl.searchParams.get('destination');

  if (!originText || !destinationText) {
    return NextResponse.json(
      { error: 'กรุณาระบุต้นทางและปลายทาง' },
      { status: 400 }
    );
  }

  try {
    // 1. Check DB first for an exact name match to avoid redundant API calls
    const existing = await db.$queryRawUnsafe(`
      SELECT * FROM "routes"
      WHERE "originName" = '${originText.trim().replace(/'/g, "''")}'
        AND "destinationName" = '${destinationText.trim().replace(/'/g, "''")}'
      ORDER BY "lastUsedAt" DESC
      LIMIT 1
    `) as any[];

    if (existing && existing.length > 0) {
      const e = existing[0];
      // Update useCount and lastUsedAt
      await db.$executeRawUnsafe(`
        UPDATE "routes"
        SET "useCount" = ${e.useCount + 1}, "lastUsedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = '${e.id}'
      `);

      return NextResponse.json({
        origin: { name: e.originName, lat: e.originLat, lng: e.originLng },
        destination: { name: e.destinationName, lat: e.destinationLat, lng: e.destinationLng },
        distanceKm: e.distance,
        durationMinutes: e.duration,
        routeId: e.id,
        cached: true,
      });
    }

    // 2. Geocode both places
    const [originResults, destinationResults] = await Promise.all([
      geocode(originText.trim()),
      geocode(destinationText.trim()),
    ]);

    if (originResults.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบสถานที่ต้นทาง กรุณาลองคำค้นหาอื่น' },
        { status: 404 }
      );
    }

    if (destinationResults.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบสถานที่ปลายทาง กรุณาลองคำค้นหาอื่น' },
        { status: 404 }
      );
    }

    const origin = originResults[0];
    const destination = destinationResults[0];

    // 3. Get route from ORS
    const routeResult = await getRoute(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng }
    );

    if (!routeResult) {
      return NextResponse.json(
        { error: 'ไม่สามารถคำนวณเส้นทางได้ กรุณาลองอีกครั้ง' },
        { status: 404 }
      );
    }

    // 4. Auto-save to DB using raw SQL
    const routeId = `r_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await db.$executeRawUnsafe(`
      INSERT INTO "routes" ("id", "originName", "originLat", "originLng",
        "destinationName", "destinationLat", "destinationLng",
        "distance", "duration", "useCount", "lastUsedAt", "createdAt", "updatedAt")
      VALUES ('${routeId}',
        '${origin.name.replace(/'/g, "''")}', ${origin.lat}, ${origin.lng},
        '${destination.name.replace(/'/g, "''")}', ${destination.lat}, ${destination.lng},
        ${routeResult.distanceKm}, ${routeResult.durationMinutes},
        1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    return NextResponse.json({
      origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
      destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
      distanceKm: routeResult.distanceKm,
      durationMinutes: routeResult.durationMinutes,
      bbox: routeResult.bbox,
      routeId,
      cached: false,
    });
  } catch (error) {
    console.error('[API /distance] Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการค้นหาระยะทาง' },
      { status: 500 }
    );
  }
}
