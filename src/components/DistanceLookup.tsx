'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

// ===== Types =====
interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

interface SavedRoute {
  id: string;
  originName: string;
  originLat: number | null;
  originLng: number | null;
  destinationName: string;
  destinationLat: number | null;
  destinationLng: number | null;
  distance: number;
  duration: number | null;
  useCount: number;
  isFavorite: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface DistanceResult {
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  distanceKm: number;
  durationMinutes: number;
  bbox?: [number, number, number, number];
  routeId: string;
  cached?: boolean;
}

interface DistanceLookupProps {
  onApplyDistance: (distanceKm: number, originName: string, destinationName: string) => void;
  distanceRef?: React.RefObject<HTMLDivElement | null>;
}

// ===== Autocomplete Input Component =====
function AutocompleteInput({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (result: GeocodeResult) => void;
  placeholder: string;
}) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced geocode
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value || value.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setShowDropdown((data.results || []).length > 0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none pr-8"
          placeholder={placeholder}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={idx}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0 transition-colors"
              onClick={() => {
                onSelect(result);
                setShowDropdown(false);
                setResults([]);
              }}
            >
              <span className="text-gray-800">{result.name}</span>
              <span className="text-gray-400 text-xs ml-1">
                ({result.lat.toFixed(4)}, {result.lng.toFixed(4)})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Main Distance Lookup Component =====
export default function DistanceLookup({ onApplyDistance, distanceRef }: DistanceLookupProps) {
  const { toast } = useToast();

  // Input state
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<GeocodeResult | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<GeocodeResult | null>(null);

  // Search state
  const [searching, setSearching] = useState(false);
  const [distanceResult, setDistanceResult] = useState<DistanceResult | null>(null);

  // Saved routes state
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  // Load saved routes
  const loadSavedRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/routes');
      if (res.ok) {
        const data = await res.json();
        setSavedRoutes(data.routes || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  useEffect(() => {
    loadSavedRoutes();
  }, [loadSavedRoutes]);

  // Search distance
  const handleSearch = async () => {
    if (!originText.trim() || !destinationText.trim()) {
      toast({ title: 'กรุณาระบุต้นทางและปลายทาง', variant: 'destructive' });
      return;
    }

    setSearching(true);
    setDistanceResult(null);

    try {
      const params = new URLSearchParams({
        origin: selectedOrigin?.name || originText.trim(),
        destination: selectedDestination?.name || destinationText.trim(),
      });

      const res = await fetch(`/api/distance?${params}`);
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'ค้นหาไม่สำเร็จ',
          description: data.error || 'เกิดข้อผิดพลาด',
          variant: 'destructive',
        });
        return;
      }

      setDistanceResult(data);

      // Update selected origin/destination with full names from API
      if (data.origin) {
        setSelectedOrigin(data.origin);
        setOriginText(data.origin.name);
      }
      if (data.destination) {
        setSelectedDestination(data.destination);
        setDestinationText(data.destination.name);
      }

      // Refresh saved routes
      await loadSavedRoutes();

      toast({
        title: data.cached ? 'ใช้ข้อมูลที่บันทึกไว้' : 'ค้นหาสำเร็จ',
        description: `ระยะทาง ${data.distanceKm.toFixed(1)} กม. ใช้เวลาประมาณ ${Math.round(data.durationMinutes)} นาที`,
      });
    } catch {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (routeId: string, currentFavorite: boolean) => {
    try {
      const res = await fetch(`/api/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentFavorite }),
      });

      if (res.ok) {
        setSavedRoutes((prev) =>
          prev.map((r) => (r.id === routeId ? { ...r, isFavorite: !currentFavorite } : r))
        );
      }
    } catch {
      // ignore
    }
  };

  // Apply a saved route
  const applySavedRoute = (route: SavedRoute) => {
    setOriginText(route.originName);
    setDestinationText(route.destinationName);
    setSelectedOrigin(
      route.originLat && route.originLng
        ? { name: route.originName, lat: route.originLat, lng: route.originLng }
        : null
    );
    setSelectedDestination(
      route.destinationLat && route.destinationLng
        ? { name: route.destinationName, lat: route.destinationLat, lng: route.destinationLng }
        : null
    );
    setDistanceResult({
      origin: {
        name: route.originName,
        lat: route.originLat || 0,
        lng: route.originLng || 0,
      },
      destination: {
        name: route.destinationName,
        lat: route.destinationLat || 0,
        lng: route.destinationLng || 0,
      },
      distanceKm: route.distance,
      durationMinutes: route.duration || 0,
      routeId: route.id,
    });

    // Apply distance to price calculator
    onApplyDistance(route.distance, route.originName, route.destinationName);

    toast({
      title: 'ใช้เส้นทางที่บันทึกไว้',
      description: `${route.originName} → ${route.destinationName} (${route.distance.toFixed(1)} กม.)`,
    });
  };

  // Apply distance to calculator
  const handleApplyDistance = () => {
    if (!distanceResult) return;
    onApplyDistance(
      distanceResult.distanceKm,
      distanceResult.origin.name,
      distanceResult.destination.name
    );
    toast({
      title: 'ใช้ระยะทางนี้',
      description: `${distanceResult.distanceKm.toFixed(1)} กม. ถูกใส่ในช่องระยะทางแล้ว`,
    });
  };

  // Save route as favorite
  const handleSaveFavorite = async () => {
    if (!distanceResult) return;
    try {
      await fetch(`/api/routes/${distanceResult.routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: true }),
      });
      await loadSavedRoutes();
      toast({ title: 'บันทึกเส้นทางแล้ว', description: 'เพิ่มในรายการโปรดแล้ว' });
    } catch {
      toast({ title: 'บันทึกไม่สำเร็จ', variant: 'destructive' });
    }
  };

  // Build OSM embed URL
  const getMapEmbedUrl = () => {
    if (!distanceResult?.bbox) return '';
    const [minLng, minLat, maxLng, maxLat] = distanceResult.bbox;
    const padding = 0.02;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng - padding},${minLat - padding},${maxLng + padding},${maxLat + padding}&layer=mapnik`;
  };

  return (
    <div ref={distanceRef} className="space-y-4">
      {/* Distance Lookup Card */}
      <section className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
          <h2 className="text-lg font-bold">🗺️ ค้นหาระยะทาง</h2>
          <p className="text-blue-100 text-sm">ค้นหาระยะทางระหว่างสถานที่อัตโนมัติ (OpenRouteService)</p>
        </div>
        <div className="p-4 space-y-4">
          {/* Input Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AutocompleteInput
              label="ต้นทาง"
              value={originText}
              onChange={(val) => {
                setOriginText(val);
                setSelectedOrigin(null);
              }}
              onSelect={(result) => {
                setOriginText(result.name);
                setSelectedOrigin(result);
              }}
              placeholder="เช่น กรุงเทพมหานคร"
            />
            <AutocompleteInput
              label="ปลายทาง"
              value={destinationText}
              onChange={(val) => {
                setDestinationText(val);
                setSelectedDestination(null);
              }}
              onSelect={(result) => {
                setDestinationText(result.name);
                setSelectedDestination(result);
              }}
              placeholder="เช่น เชียงใหม่"
            />
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={searching || !originText.trim() || !destinationText.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-600 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {searching ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                กำลังค้นหา...
              </>
            ) : (
              <>🔍 ค้นหาระยะทาง</>
            )}
          </button>

          {/* Results Area */}
          {distanceResult && (
            <div className="space-y-4">
              {/* Distance & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-gray-600 text-sm">ระยะทาง</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {distanceResult.distanceKm.toFixed(1)}
                  </p>
                  <p className="text-blue-500 text-xs">กิโลเมตร</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <p className="text-gray-600 text-sm">เวลาเดินทางโดยประมาณ</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {distanceResult.durationMinutes >= 60
                      ? `${Math.floor(distanceResult.durationMinutes / 60)} ชม. ${Math.round(distanceResult.durationMinutes % 60)} น.`
                      : `${Math.round(distanceResult.durationMinutes)}`}
                  </p>
                  {distanceResult.durationMinutes < 60 && (
                    <p className="text-indigo-500 text-xs">นาที</p>
                  )}
                </div>
              </div>

              {/* Route Info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                <span className="font-medium">{distanceResult.origin.name}</span>
                {' → '}
                <span className="font-medium">{distanceResult.destination.name}</span>
                {distanceResult.cached && (
                  <span className="ml-2 text-xs text-blue-500">(ข้อมูลจากที่บันทึกไว้)</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleApplyDistance}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700 transition text-sm"
                >
                  ✅ ใช้ระยะทางนี้
                </button>
                <button
                  onClick={handleSaveFavorite}
                  className="px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition text-sm"
                >
                  💾 บันทึกเส้นทาง
                </button>
              </div>

              {/* Map Embed */}
              {distanceResult.bbox && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <iframe
                    src={getMapEmbedUrl()}
                    width="100%"
                    height="300"
                    style={{ border: 0 }}
                    title="แผนที่เส้นทาง"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Saved Routes Section */}
      <section className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4">
          <h2 className="text-lg font-bold">⭐ เส้นทางที่บันทึกไว้</h2>
          <p className="text-amber-100 text-xs">คลิกเส้นทางเพื่อใช้งานทันที</p>
        </div>
        <div className="p-4">
          {loadingRoutes ? (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-2 text-sm">กำลังโหลด...</p>
            </div>
          ) : savedRoutes.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              ยังไม่มีเส้นทางที่บันทึกไว้ ค้นหาระยะทางแล้วกด &quot;💾 บันทึกเส้นทาง&quot;
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedRoutes.map((route) => (
                <div
                  key={route.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => applySavedRoute(route)}
                >
                  {/* Favorite Star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(route.id, route.isFavorite);
                    }}
                    className={`text-lg flex-shrink-0 transition-colors ${
                      route.isFavorite ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'
                    }`}
                    title={route.isFavorite ? 'เอาออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
                  >
                    {route.isFavorite ? '★' : '☆'}
                  </button>

                  {/* Route Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {route.originName} → {route.destinationName}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{route.distance.toFixed(1)} กม.</span>
                      {route.duration && (
                        <span>
                          {route.duration >= 60
                            ? `${Math.floor(route.duration / 60)} ชม. ${Math.round(route.duration % 60)} น.`
                            : `${Math.round(route.duration)} นาที`}
                        </span>
                      )}
                      <span>ใช้ {route.useCount} ครั้ง</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
