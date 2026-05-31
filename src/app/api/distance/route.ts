import { NextRequest, NextResponse } from 'next/server';
import { geocode, getRoute } from '@/lib/ors-api';
import { db } from '@/lib/db';

/**
 * GET /api/distance?origin=...&destination=...
 *
 * Look up distance between two locations.
 * - Checks DB cache first (by exact origin/destination name match)
 * - Falls back to OpenRouteService geocode + routing API
 * - Auto-saves new routes to DB for future caching
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

  try {
    // 1. Check DB first for an exact name match to avoid redundant API calls
    const existingRoutes = await db.route.findMany({
      where: {
        originName: originText.trim(),
        destinationName: destinationText.trim(),
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 1,
    });

    if (existingRoutes.length > 0) {
      const existing = existingRoutes[0];
      // Update useCount and lastUsedAt
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

    // 4. Auto-save to DB
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
