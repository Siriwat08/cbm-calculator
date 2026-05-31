import { NextRequest, NextResponse } from 'next/server';
import { geocode, getRoute } from '@/lib/ors-api';
import { getDb } from '@/lib/db';

/**
 * GET /api/distance?origin=...&destination=...
 *
 * Look up distance between two locations.
 * Caching strategy:
 *   1. Check DB by raw search text (exact match) — zero API calls
 *   2. Geocode both places
 *   3. Check DB by geocoded names (exact match) — saves routing call
 *   4. Call ORS routing API — full lookup
 *   5. Auto-save route to DB
 */
export async function GET(request: NextRequest) {
  const originText = request.nextUrl.searchParams.get('origin');
  const destinationText = request.nextUrl.searchParams.get('destination');

  if (!originText || !destinationText) {
    return NextResponse.json(
      { error: 'กรุณาระบุต้นทางและปลายทาง' },
      { status: 400 }
    );
  }

  const originTrimmed = originText.trim();
  const destTrimmed = destinationText.trim();

  try {
    const db = getDb();

    // 1. Check DB by raw search text (zero API calls)
    const bySearchText = await db.route.findMany({
      where: {
        originName: originTrimmed,
        destinationName: destTrimmed,
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 1,
    });

    if (bySearchText.length > 0) {
      const existing = bySearchText[0];
      await db.route.update({
        where: { id: existing.id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      return NextResponse.json({
        origin: {
          name: existing.originName,
          lat: existing.originLat,
          lng: existing.originLng,
        },
        destination: {
          name: existing.destinationName,
          lat: existing.destinationLat,
          lng: existing.destinationLng,
        },
        distanceKm: existing.distance,
        durationMinutes: existing.duration,
        routeId: existing.id,
        cached: true,
      });
    }

    // 2. Geocode both places
    const [originResults, destinationResults] = await Promise.all([
      geocode(originTrimmed),
      geocode(destTrimmed),
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

    // 3. Check DB by geocoded names (saves routing API call)
    const byGeocodedName = await db.route.findMany({
      where: {
        originName: origin.name,
        destinationName: destination.name,
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 1,
    });

    if (byGeocodedName.length > 0) {
      const existing = byGeocodedName[0];

      // Also save the search text as an alias for future lookups
      // by creating a new entry with the search text as the name
      const aliasRoute = await db.route.create({
        data: {
          originName: originTrimmed,
          originLat: origin.lat,
          originLng: origin.lng,
          destinationName: destTrimmed,
          destinationLat: destination.lat,
          destinationLng: destination.lng,
          distance: existing.distance,
          duration: existing.duration,
          useCount: 1,
          lastUsedAt: new Date(),
        },
      });

      // Update the original route's use count
      await db.route.update({
        where: { id: existing.id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      return NextResponse.json({
        origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
        destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
        distanceKm: existing.distance,
        durationMinutes: existing.duration,
        routeId: aliasRoute.id,
        cached: true,
      });
    }

    // 4. Call ORS routing API (full lookup)
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

    // 5. Auto-save to DB
    const savedRoute = await db.route.create({
      data: {
        originName: origin.name,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationName: destination.name,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        distance: routeResult.distanceKm,
        duration: routeResult.durationMinutes,
        useCount: 1,
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
      destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
      distanceKm: routeResult.distanceKm,
      durationMinutes: routeResult.durationMinutes,
      bbox: routeResult.bbox,
      routeId: savedRoute.id,
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
