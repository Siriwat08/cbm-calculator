/**
 * OpenRouteService API Wrapper
 *
 * Provides geocoding and routing functions using the ORS API.
 * Free tier: 2,000 requests/day — cache aggressively.
 */

const ORS_API_KEY = process.env.ORS_API_KEY || '';

// ===== Types =====

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

// ===== Geocoding =====

export async function geocode(query: string): Promise<GeocodeResult[]> {
  if (!ORS_API_KEY) {
    console.warn('[ORS] ORS_API_KEY not configured');
    return [];
  }

  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=5`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[ORS] Geocode API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const features = data?.features;

    if (!Array.isArray(features)) {
      return [];
    }

    return features
      .filter((f: { geometry?: { coordinates?: number[] } }) => (f.geometry?.coordinates?.length ?? 0) >= 2)
      .map((f: { properties?: { label?: string }; geometry: { coordinates: number[] } }) => ({
        name: f.properties?.label || 'Unknown',
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
  } catch (error) {
    console.error('[ORS] Geocode error:', error);
    return [];
  }
}

// ===== Routing =====

export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
  if (!ORS_API_KEY) {
    console.warn('[ORS] ORS_API_KEY not configured');
    return null;
  }

  try {
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[ORS] Directions API error: ${response.status} ${errorBody}`);
      return null;
    }

    const data = await response.json();
    const route = data?.routes?.[0];

    if (!route) {
      console.error('[ORS] No route found in response');
      return null;
    }

    const summary = route.summary || {};
    const bbox: [number, number, number, number] = data?.metadata?.query?.coordinates
      ? [
          Math.min(origin.lng, destination.lng) - 0.01,
          Math.min(origin.lat, destination.lat) - 0.01,
          Math.max(origin.lng, destination.lng) + 0.01,
          Math.max(origin.lat, destination.lat) + 0.01,
        ]
      : (route.bbox as [number, number, number, number]) || [0, 0, 0, 0];

    return {
      distanceKm: (summary.distance || 0) / 1000,
      durationMinutes: (summary.duration || 0) / 60,
      bbox: data?.bbox || bbox,
    };
  } catch (error) {
    console.error('[ORS] Directions error:', error);
    return null;
  }
}
