'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { truckTypes, getTruckByJobKey } from '@/lib/truck-data';
import { FALLBACK_DIESEL_PRICE, LABOR_COST, CARGO_LIMITS } from '@/lib/oil-price-api';
import { performBinPacking } from '@/lib/bin-packing';
import { formatDisplayDate } from '@/lib/date-utils';
import BinPackingVisualization from '@/components/BinPackingVisualization';
import DistanceLookup from '@/components/DistanceLookup';
import { useToast } from '@/hooks/use-toast';
import type { OilPrice, RateData, TruckType, CargoItem, BinPackingResult } from '@/lib/types';
import MultiTripCalculator from '@/components/MultiTripCalculator';

export default function Home() {
  // ===== Tab State =====
  const [activeTab, setActiveTab] = useState<'cbm' | 'price' | 'multitrip'>('cbm');

  // ===== Oil Price State =====
  const [currentOilPrice, setCurrentOilPrice] = useState<number>(FALLBACK_DIESEL_PRICE);
  const [oilPriceHistory, setOilPriceHistory] = useState<OilPrice[]>([]);
  const [loadingOil, setLoadingOil] = useState(true);
  const [liveOilPrice, setLiveOilPrice] = useState<number | null>(null);

  // ===== Manual Oil Price Input (session-only) =====
  const [showOilPriceForm, setShowOilPriceForm] = useState(false);
  const [manualPrice, setManualPrice] = useState<string>('');
  const [usingManualPrice, setUsingManualPrice] = useState(false);
  const [originalOilPrice, setOriginalOilPrice] = useState<number>(FALLBACK_DIESEL_PRICE);

  // ===== Price Calculator State =====
  const [selectedJob, setSelectedJob] = useState<string>('4ล้อ_PPY');
  const [distance, setDistance] = useState<string>('');
  const [routeDescription, setRouteDescription] = useState<string>('');

  // ===== Labor State =====
  const [includeLabor, setIncludeLabor] = useState(false);

  // ===== CBM Calculator State =====
  const [selectedTruck, setSelectedTruck] = useState<TruckType>(truckTypes[0]);
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
  ]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupImage, setPopupImage] = useState('');

  // ===== Oil Price History Display =====
  const [showAllHistory, setShowAllHistory] = useState(false);

  // ===== Admin API Key (stored in localStorage) =====
  const [adminApiKey, setAdminApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_api_key') || '';
    }
    return '';
  });

  // ===== Toast notifications =====
  const { toast } = useToast();

  // ===== Rate Data State =====
  const [rateData, setRateData] = useState<RateData | null>(null);
  const [availableJobs, setAvailableJobs] = useState<string[]>([]);
  const [loadingRates, setLoadingRates] = useState(true);

  // ===== Distance Lookup Ref =====
  const distanceLookupRef = useRef<HTMLDivElement>(null);

  // ===== Reset Trigger for DistanceLookup =====
  const [resetTrigger, setResetTrigger] = useState(0);

  // ===== Derived State =====
  const validationErrors = useMemo<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    cargoItems.forEach((item, index) => {
      if (item.width < 0) errors[index.toString()] = `รายการ ${index + 1}: ความกว้างต้องไม่ติดลบ`;
      else if (item.length < 0) errors[index.toString()] = `รายการ ${index + 1}: ความยาวต้องไม่ติดลบ`;
      else if (item.height < 0) errors[index.toString()] = `รายการ ${index + 1}: ความสูงต้องไม่ติดลบ`;
      else if (item.weight < 0) errors[index.toString()] = `รายการ ${index + 1}: น้ำหนักต้องไม่ติดลบ`;
      else if (item.width > CARGO_LIMITS.MAX_DIMENSION_CM) errors[index.toString()] = `รายการ ${index + 1}: ความกว้างเกิน ${CARGO_LIMITS.MAX_DIMENSION_CM.toLocaleString()} ซม.`;
      else if (item.length > CARGO_LIMITS.MAX_DIMENSION_CM) errors[index.toString()] = `รายการ ${index + 1}: ความยาวเกิน ${CARGO_LIMITS.MAX_DIMENSION_CM.toLocaleString()} ซม.`;
      else if (item.height > CARGO_LIMITS.MAX_DIMENSION_CM) errors[index.toString()] = `รายการ ${index + 1}: ความสูงเกิน ${CARGO_LIMITS.MAX_DIMENSION_CM.toLocaleString()} ซม.`;
      else if (item.weight > CARGO_LIMITS.MAX_WEIGHT_KG) errors[index.toString()] = `รายการ ${index + 1}: น้ำหนักเกิน ${CARGO_LIMITS.MAX_WEIGHT_KG.toLocaleString()} kg`;
      else if (item.quantity > CARGO_LIMITS.MAX_QUANTITY) errors[index.toString()] = `รายการ ${index + 1}: จำนวนเกิน ${CARGO_LIMITS.MAX_QUANTITY.toLocaleString()}`;
    });
    return errors;
  }, [cargoItems]);

  const binPackingResult = useMemo<BinPackingResult | null>(() => {
    const allValid = cargoItems.every(item => item.width > 0 && item.length > 0 && item.height > 0);
    if (!allValid) return null;
    return performBinPacking(cargoItems, selectedTruck);
  }, [cargoItems, selectedTruck]);

  const { calculatedPrice, priceDetails } = useMemo(() => {
    if (!rateData || !distance || currentOilPrice == null) {
      return { calculatedPrice: null, priceDetails: null };
    }
    const jobData = rateData[selectedJob];
    if (!jobData) return { calculatedPrice: null, priceDetails: null };

    const dist = parseFloat(distance);
    if (isNaN(dist) || dist <= 0) return { calculatedPrice: null, priceDetails: null };

    let oilIndex = -1;
    for (let i = 0; i < jobData.oil_ranges.length; i++) {
      const range = jobData.oil_ranges[i];
      if (currentOilPrice >= range.min && currentOilPrice <= range.max) {
        oilIndex = i;
        break;
      }
    }
    if (oilIndex === -1) oilIndex = jobData.oil_ranges.length - 1;

    let distIndex = -1;
    let distRange = '';
    if (jobData.data && jobData.data.length > 0) {
      for (let i = 0; i < jobData.data.length; i++) {
        const row = jobData.data[i];
        if (dist >= row.dist_min && dist <= row.dist_max) {
          distIndex = i;
          distRange = `${row.dist_min} - ${row.dist_max} กม.`;
          break;
        }
      }
      if (distIndex === -1) {
        if (dist < jobData.data[0].dist_min) {
          distIndex = 0;
          distRange = `0 - ${jobData.data[0].dist_max} กม.`;
        } else {
          distIndex = jobData.data.length - 1;
          const lastRow = jobData.data[distIndex];
          distRange = `${lastRow.dist_min}+ กม.`;
        }
      }
    }

    if (distIndex >= 0 && jobData.data[distIndex]?.prices?.[oilIndex] !== undefined) {
      const price = jobData.data[distIndex].prices[oilIndex];
      const oilRange = `${jobData.oil_ranges[oilIndex].min} - ${jobData.oil_ranges[oilIndex].max} บาท`;
      return { calculatedPrice: price, priceDetails: { oilRange, distRange } };
    }
    return { calculatedPrice: null, priceDetails: null };
  }, [rateData, selectedJob, distance, currentOilPrice]);

  // ===== Data Fetching =====
  const applyOilPriceData = useCallback((data: { price?: number; livePrice?: { price?: number } | null; history?: OilPrice[] }) => {
    if (data.price !== undefined && data.price !== null) {
      setCurrentOilPrice(data.price);
      if (usingManualPrice) setOriginalOilPrice(data.price);
    }
    if (data.livePrice?.price) setLiveOilPrice(data.livePrice.price);
    if (data.history && data.history.length > 0) setOilPriceHistory(data.history);
  }, [usingManualPrice]);

  const saveAdminApiKey = (key: string) => {
    setAdminApiKey(key);
    if (key) localStorage.setItem('admin_api_key', key);
    else localStorage.removeItem('admin_api_key');
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/transport_rates.json')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data: RateData) => {
        if (cancelled) return;
        setRateData(data);
        const keys = Object.keys(data);
        setAvailableJobs(keys);
        if (keys.length > 0) setSelectedJob(keys[0]);
      })
      .catch((err) => {
        console.error('Failed to load rate data:', err);
        toast({ title: 'โหลดข้อมูลล้มเหลว', description: 'ไม่สามารถโหลดอัตราค่าขนส่งได้', variant: 'destructive' });
      })
      .finally(() => { if (!cancelled) setLoadingRates(false); });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/oil-price')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data) => { if (!cancelled) applyOilPriceData(data); })
      .catch((error) => {
        console.error('Failed to fetch oil price:', error);
        toast({ title: 'โหลดราคาน้ำมันล้มเหลว', description: 'ใช้ราคาสำรองชั่วคราว', variant: 'destructive' });
      })
      .finally(() => { if (!cancelled) setLoadingOil(false); });
    return () => { cancelled = true; };
  }, [applyOilPriceData, toast]);

  const refreshOilPrice = useCallback(async () => {
    setLoadingOil(true);
    try {
      const res = await fetch('/api/oil-price');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyOilPriceData(data);
    } catch (error) {
      console.error('Failed to fetch oil price:', error);
      toast({ title: 'โหลดราคาน้ำมันล้มเหลว', description: 'ใช้ราคาสำรองชั่วคราว', variant: 'destructive' });
    } finally {
      setLoadingOil(false);
    }
  }, [applyOilPriceData, toast]);

  // ===== Handlers =====
  const goToPriceCalculator = (truck: TruckType) => {
    setSelectedTruck(truck);
    setSelectedJob(truck.jobKey);
    setActiveTab('price');
  };

  const handleJobChange = (jobKey: string) => {
    setSelectedJob(jobKey);
    const matchingTruck = getTruckByJobKey(jobKey);
    if (matchingTruck) setSelectedTruck(matchingTruck);
  };

  const calculateCBM = (item: CargoItem) => ((item.width * item.length * item.height) / 1000000) * item.quantity;
  const totalCBM = cargoItems.reduce((sum, item) => sum + calculateCBM(item), 0);
  const totalWeight = cargoItems.reduce((sum, item) => sum + item.weight * item.quantity, 0);

  const recommendedTruck = useMemo(() => {
    if (cargoItems.length === 0 || totalCBM <= 0) return null;
    const allValid = cargoItems.every((item) => item.width > 0 && item.length > 0 && item.height > 0 && item.weight > 0);
    if (!allValid) return null;
    for (const truck of truckTypes) {
      const result = performBinPacking(cargoItems, truck);
      if (result.canFitAll && totalWeight <= truck.maxWeight) return truck;
    }
    return null;
  }, [cargoItems, totalCBM, totalWeight]);

  const allItemsValid = cargoItems.every((item) => item.width > 0 && item.length > 0 && item.height > 0 && item.weight > 0);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const addCargoItem = () => setCargoItems([...cargoItems, { id: crypto.randomUUID(), width: 0, length: 0, height: 0, quantity: 1, weight: 0 }]);
  const removeCargoItem = (id: string) => { if (cargoItems.length > 1) setCargoItems(cargoItems.filter((item) => item.id !== id)); };
  const updateCargoItem = (id: string, field: keyof CargoItem, value: number) => setCargoItems(cargoItems.map((item) => item.id === id ? { ...item, [field]: value } : item));
  const resetForm = () => { setCargoItems([{ id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 }]); setSelectedTruck(truckTypes[0]); };

  // Reset ALL data across both tabs
  const resetAllData = () => {
    if (!confirm('ต้องการรีเซ็ตข้อมูลทั้งหมดใช่หรือไม่? ข้อมูลทุกหน้าจะถูกล้าง')) return;
    // CBM tab
    setCargoItems([{ id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 }]);
    setSelectedTruck(truckTypes[0]);
    // Price tab
    setSelectedJob(availableJobs.length > 0 ? availableJobs[0] : '4ล้อ_PPY');
    setDistance('');
    setRouteDescription('');
    setIncludeLabor(false);
    // Manual oil price override
    setUsingManualPrice(false);
    setManualPrice('');
    setShowOilPriceForm(false);
    setCurrentOilPrice(originalOilPrice);
    // Reset DistanceLookup
    setResetTrigger(prev => prev + 1);
    toast({ title: 'รีเซ็ตสำเร็จ', description: 'ข้อมูลทั้งหมดถูกล้างแล้ว' });
  };
  const openPopup = (image: string) => { setPopupImage(image); setShowPopup(true); };

  const handleApplyManualPrice = () => {
    const price = parseFloat(manualPrice);
    if (isNaN(price) || price <= 0 || price > 200) { alert('กรุณาใส่ราคาที่ถูกต้อง (0.01 - 200 บาท)'); return; }
    if (!usingManualPrice) setOriginalOilPrice(currentOilPrice);
    setCurrentOilPrice(price);
    setUsingManualPrice(true);
    setShowOilPriceForm(false);
    setManualPrice('');
  };

  const handleClearManualPrice = () => {
    setCurrentOilPrice(originalOilPrice);
    setUsingManualPrice(false);
    setManualPrice('');
    setShowOilPriceForm(false);
  };

  const deleteOilPrice = async (date: string) => {
    if (!confirm(`ต้องการลบราคาน้ำมันวันที่ ${formatDisplayDate(date)} ใช่หรือไม่?`)) return;
    try {
      const headers: HeadersInit = {};
      if (adminApiKey) headers['x-api-key'] = adminApiKey;
      const res = await fetch(`/api/oil-price?date=${encodeURIComponent(date)}`, { method: 'DELETE', headers });
      if (res.status === 401) { toast({ title: 'ไม่มีสิทธิ์', description: 'กรุณาใส่รหัสแอดมินก่อนลบข้อมูล', variant: 'destructive' }); return; }
      if (res.ok) { await refreshOilPrice(); toast({ title: 'ลบสำเร็จ', description: 'ลบราคาน้ำมันเรียบร้อยแล้ว' }); }
      else { const data = await res.json().catch(() => ({})); toast({ title: 'ลบไม่สำเร็จ', description: data.error || 'เกิดข้อผิดพลาด', variant: 'destructive' }); }
    } catch { toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', variant: 'destructive' }); }
  };

  // ===== Distance Lookup Integration =====
  const handleApplyDistance = (distanceKm: number, originName: string, destinationName: string) => {
    setDistance(distanceKm.toFixed(1));
    setRouteDescription(`${originName} → ${destinationName}`);
    // Scroll to price calculator
    setTimeout(() => {
      distanceLookupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const scrollToDistanceLookup = () => {
    distanceLookupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-4 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Image src="/images/3_20251016_054221_0002.png" alt="เผ่าปัญญา ทรานสปอร์ต" width={60} height={60} className="rounded-full" />
          <div>
            <h1 className="text-xl font-bold">หจก.เผ่าปัญญา ทรานสปอร์ต</h1>
            <p className="text-slate-300 text-sm">เครื่องมือช่วยคำนวณการขนส่ง</p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-4 w-full">
        <div className="flex gap-2 bg-white rounded-lg shadow p-1">
          <button onClick={() => setActiveTab('cbm')} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${activeTab === 'cbm' ? 'bg-slate-800 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📦 คำนวณ CBM
          </button>
          <button onClick={() => setActiveTab('price')} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${activeTab === 'price' ? 'bg-slate-800 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            💰 คำนวณราคา
          </button>
          <button onClick={() => setActiveTab('multitrip')} className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${activeTab === 'multitrip' ? 'bg-slate-800 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            🚚 Multi-Trip
          </button>
        </div>
      </div>

      {/* Loading Rates Banner */}
      {loadingRates && (
        <div className="max-w-4xl mx-auto px-4 mt-3 w-full">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            กำลังโหลดข้อมูลอัตราค่าขนส่ง...
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 flex-1 w-full">
        {/* ===== CBM Calculator Tab ===== */}
        {activeTab === 'cbm' && (
          <div className="space-y-6">
            {/* Truck Selection */}
            <section className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🚛 เลือกประเภทรถ</h2>
                <p className="text-emerald-100 text-sm">เลือกรถแล้วกด &quot;คำนวณราคา&quot; เพื่อไปหน้าคำนวณราคาอัตโนมัติ</p>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {truckTypes.map((truck) => (
                  <div key={truck.id} className={`rounded-xl border-2 transition-all ${selectedTruck.id === truck.id ? 'border-emerald-500 bg-emerald-50 shadow-lg' : 'border-gray-200 hover:border-emerald-300'}`}>
                    <div className="relative h-48 overflow-hidden rounded-t-xl cursor-pointer" onClick={() => setSelectedTruck(truck)}>
                      <Image src={truck.image} alt={truck.name} fill className="object-cover object-top" style={{ objectPosition: 'top' }} />
                      <button onClick={(e) => { e.stopPropagation(); openPopup(truck.image); }} className="absolute bottom-2 left-2 bg-white text-emerald-600 text-xs px-2 py-1 rounded shadow hover:bg-emerald-50">
                        ดูข้อมูลเพิ่มเติม
                      </button>
                      {selectedTruck.id === truck.id && (
                        <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-full p-1">✓</div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-gray-800">{truck.name}</h3>
                      <p className="text-sm text-gray-600">CBM: {truck.cbm} | น้ำหนัก: {truck.maxWeight.toLocaleString()} kg</p>
                      <p className="text-xs text-gray-400 mt-1">ขนาด: {truck.dimensions.width}×{truck.dimensions.length}×{truck.dimensions.height} ม.</p>
                      <button onClick={() => goToPriceCalculator(truck)} className="mt-2 w-full py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700 transition text-sm">
                        💰 คำนวณราคา
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Cargo Items */}
            <section className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="text-lg font-bold">📦 รายการสินค้า</h2>
                  <p className="text-amber-100 text-xs">กดปุ่ม &quot;+ เพิ่มรายการ&quot; เพื่อเพิ่มรายการสินค้า</p>
                </div>
                <button onClick={addCargoItem} className="bg-white text-orange-600 px-3 py-1 rounded-lg font-medium hover:bg-orange-50">+ เพิ่มรายการ</button>
              </div>
              <div className="p-4 space-y-4">
                {cargoItems.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800 bg-emerald-100 px-3 py-1 rounded">รายการที่ {index + 1}</span>
                      {cargoItems.length > 1 && <button onClick={() => removeCargoItem(item.id)} className="text-red-500 hover:text-red-700 font-medium text-sm">✕ ลบ</button>}
                    </div>
                    {validationErrors[index.toString()] && (
                      <div className="mb-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">⚠️ {validationErrors[index.toString()]}</div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-medium">กว้าง (ซม.) *</label>
                        <input type="number" value={item.width || ''} onChange={(e) => updateCargoItem(item.id, 'width', parseFloat(e.target.value) || 0)} inputMode="decimal" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none" placeholder="0" min="0.1" max={CARGO_LIMITS.MAX_DIMENSION_CM} step="0.1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">ยาว (ซม.) *</label>
                        <input type="number" value={item.length || ''} onChange={(e) => updateCargoItem(item.id, 'length', parseFloat(e.target.value) || 0)} inputMode="decimal" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none" placeholder="0" min="0.1" max={CARGO_LIMITS.MAX_DIMENSION_CM} step="0.1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">สูง (ซม.) *</label>
                        <input type="number" value={item.height || ''} onChange={(e) => updateCargoItem(item.id, 'height', parseFloat(e.target.value) || 0)} inputMode="decimal" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none" placeholder="0" min="0.1" max={CARGO_LIMITS.MAX_DIMENSION_CM} step="0.1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">จำนวน</label>
                        <input type="number" value={item.quantity} onChange={(e) => updateCargoItem(item.id, 'quantity', parseInt(e.target.value) || 1)} inputMode="numeric" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none" min="1" max={CARGO_LIMITS.MAX_QUANTITY} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">น้ำหนัก (kg) *</label>
                        <input type="number" value={item.weight || ''} onChange={(e) => updateCargoItem(item.id, 'weight', parseFloat(e.target.value) || 0)} inputMode="decimal" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none" placeholder="0" min="0.1" max={CARGO_LIMITS.MAX_WEIGHT_KG} step="0.1" />
                      </div>
                    </div>
                    {item.width > 0 && item.length > 0 && item.height > 0 && (
                      <div className="mt-3 p-2 bg-emerald-50 rounded-lg">
                        <p className="text-sm text-emerald-700 font-medium">
                          📦 CBM: {calculateCBM(item).toFixed(4)} m³
                          {item.quantity > 1 && <span className="text-emerald-500 ml-1">({(item.width * item.length * item.height / 1000000).toFixed(4)} × {item.quantity})</span>}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Results - 3D Bin Packing */}
            {totalCBM > 0 && allItemsValid && !hasValidationErrors && (
              <section className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-4">
                  <h2 className="text-lg font-bold">📊 ผลการตรวจสอบ (3D Bin Packing)</h2>
                  <p className="text-teal-100 text-sm">ตรวจสอบการจัดวางสินค้าในรถแบบ 3 มิติ</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-gray-600 text-sm">ปริมาตรรวม</p>
                      <p className="text-2xl font-bold text-blue-600">{totalCBM.toFixed(4)} m³</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <p className="text-gray-600 text-sm">น้ำหนักรวม</p>
                      <p className="text-2xl font-bold text-orange-600">{totalWeight.toLocaleString()} kg</p>
                    </div>
                  </div>
                  {binPackingResult && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 rounded-lg p-4 text-center">
                          <p className="text-gray-600 text-sm">วางสินค้าได้</p>
                          <p className="text-2xl font-bold text-emerald-600">{binPackingResult.items.length} ชิ้น</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-4 text-center">
                          <p className="text-gray-600 text-sm">วางไม่ได้</p>
                          <p className="text-2xl font-bold text-red-600">{binPackingResult.unfittedItems.length} ชิ้น</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>การใช้พื้นที่จริง (3D)</span>
                          <span>{binPackingResult.utilizationPercent.toFixed(1)}%</span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-3">
                          <div className={`h-3 rounded-full ${binPackingResult.utilizationPercent > 90 ? 'bg-red-500' : binPackingResult.utilizationPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(binPackingResult.utilizationPercent, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>การใช้น้ำหนัก</span>
                          <span>{((totalWeight / selectedTruck.maxWeight) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-3">
                          <div className={`h-3 rounded-full ${totalWeight > selectedTruck.maxWeight ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((totalWeight / selectedTruck.maxWeight) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <BinPackingVisualization result={binPackingResult} truck={selectedTruck} cargoItems={cargoItems} />
                      {binPackingResult.canFitAll && totalWeight <= selectedTruck.maxWeight && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                          <p className="text-emerald-800 font-bold text-lg">✅ สินค้าทั้งหมดใส่รถ {selectedTruck.name} ได้!</p>
                          <p className="text-emerald-600 text-sm mt-1">ใช้พื้นที่ {binPackingResult.utilizationPercent.toFixed(1)}% | น้ำหนัก {((totalWeight / selectedTruck.maxWeight) * 100).toFixed(1)}%</p>
                        </div>
                      )}
                      {binPackingResult.unfittedItems.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-800 font-medium">❌ มีสินค้าวางในรถไม่ได้</p>
                          <ul className="text-sm text-red-600 mt-1 space-y-1">{binPackingResult.unfittedItems.map((item, idx) => <li key={idx}>• {item.reason}</li>)}</ul>
                        </div>
                      )}
                      {totalWeight > selectedTruck.maxWeight && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-800 font-medium">❌ น้ำหนักรวมเกินความจุรถ</p>
                          <p className="text-sm text-red-600">น้ำหนัก {totalWeight.toLocaleString()} kg เกิน {selectedTruck.maxWeight.toLocaleString()} kg</p>
                        </div>
                      )}
                    </>
                  )}
                  {recommendedTruck && recommendedTruck.id !== selectedTruck.id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-800 font-medium">💡 แนะนำ: {recommendedTruck.name} (CBM: {recommendedTruck.cbm}, น้ำหนัก: {recommendedTruck.maxWeight.toLocaleString()} kg)</p>
                    </div>
                  )}
                  <button onClick={() => goToPriceCalculator(selectedTruck)} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-bold hover:from-emerald-600 hover:to-emerald-700 transition">
                    💰 ไปคำนวณราคาค่าขนส่ง ({selectedTruck.name})
                  </button>
                </div>
              </section>
            )}
            {hasValidationErrors && totalCBM > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">⚠️ กรุณาแก้ไขข้อผิดพลาดในรายการสินค้าก่อนดูผลลัพธ์</div>
            )}
            <button onClick={resetAllData} className="w-full bg-red-100 text-red-700 py-3 rounded-lg font-medium hover:bg-red-200 border border-red-200">🔄 รีเซ็ตข้อมูลทั้งหมด</button>
          </div>
        )}

        {/* ===== Price Calculator Tab ===== */}
        {activeTab === 'price' && (
          <div className="space-y-6">
            {/* Oil Price Card */}
            <section className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-4">
                <h2 className="text-lg font-bold">⛽ ราคาน้ำมันดีเซล</h2>
                <p className="text-emerald-100 text-sm">อ้างอิง: บริษัท ปตท. น้ำมันและการค้าปลีก จำกัด (มหาชน)</p>
                <p className="text-emerald-100 text-xs mt-0.5">ราคาขายปลีก กทม. และปริมณฑล (หน่วย: บาท/ลิตร)</p>
              </div>
              <div className="p-4">
                {loadingOil ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-2">กำลังโหลดราคาน้ำมัน...</p>
                  </div>
                ) : oilPriceHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-2 px-3 text-gray-600 font-medium w-1/4">วันที่</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-1/5">สถานะ</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-1/5">ใช้คำนวณ</th>
                          <th className="text-right py-2 px-3 text-gray-600 font-medium w-1/5">ราคา (บาท)</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-[10%]">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oilPriceHistory.slice(0, showAllHistory ? oilPriceHistory.length : 10).map((item, index) => {
                          let statusEmoji = ''; let statusText = ''; let statusColor = '';
                          if (index < oilPriceHistory.length - 1) {
                            const prevPrice = oilPriceHistory[index + 1].price;
                            const diff = item.price - prevPrice;
                            if (diff > 0) { statusEmoji = '🟢'; statusText = `▲ +${diff.toFixed(2)}`; statusColor = 'text-emerald-600'; }
                            else if (diff < 0) { statusEmoji = '🔴'; statusText = `▼ ${diff.toFixed(2)}`; statusColor = 'text-red-500'; }
                            else { statusEmoji = '⚪'; statusText = '➖ เท่าเดิม'; statusColor = 'text-gray-500'; }
                          }
                          const isCurrent = index === 0;
                          return (
                            <tr key={item.date} className={`border-b ${isCurrent ? 'bg-emerald-50 font-bold' : ''}`}>
                              <td className="py-2 px-3 text-left text-gray-700">{formatDisplayDate(item.date)}</td>
                              <td className={`py-2 px-3 text-center text-sm font-medium ${statusColor}`}>{statusEmoji} {statusText}</td>
                              <td className="py-2 px-3 text-center">{isCurrent && <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded">ใช้คำนวณ</span>}</td>
                              <td className={`py-2 px-3 text-right ${isCurrent ? 'text-emerald-600 text-lg' : 'text-gray-900'}`}>{item.price.toFixed(2)}</td>
                              <td className="py-2 px-3 text-center">{item.manual && <button onClick={() => deleteOilPrice(item.date)} className="text-red-400 hover:text-red-600 text-xs" title="ลบ">🗑️</button>}</td>
                            </tr>
                          );
                        })}
                        {oilPriceHistory.length > 10 && (
                          <tr>
                            <td colSpan={5} className="text-center pt-2">
                              <button onClick={() => setShowAllHistory(!showAllHistory)} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                                {showAllHistory ? '▲ แสดงน้อยลง' : `▼ แสดงเพิ่มเติม (${oilPriceHistory.length - 10} รายการ)`}
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-2">ราคาน้ำมันดีเซล</p>
                    <p className="text-3xl font-bold text-orange-600">{currentOilPrice.toFixed(2)} บาท</p>
                    <p className="text-sm text-orange-500 mt-2">⚠️ ใช้ข้อมูลประมาณการ</p>
                    <button onClick={refreshOilPrice} className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600">🔄 ลองโหลดใหม่</button>
                  </div>
                )}
                {/* Admin API Key */}
                <div className="mt-4 border-t pt-4">
                  <details className="group">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition">⚙️ ตั้งค่าแอดมิน</summary>
                    <div className="mt-2 flex gap-2">
                      <input type="password" value={adminApiKey} onChange={(e) => saveAdminApiKey(e.target.value)} placeholder="รหัสแอดมิน (API Key)" className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" aria-label="รหัสแอดมิน" />
                      {adminApiKey && <button onClick={() => saveAdminApiKey('')} className="text-red-400 hover:text-red-600 text-xs px-2">ล้าง</button>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">ใส่รหัสแอดมินเพื่อให้สามารถลบราคาน้ำมันได้</p>
                  </details>
                </div>
                {/* Manual Oil Price */}
                <div className="mt-3 border-t pt-4">
                  {usingManualPrice && (
                    <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                      <div className="text-sm text-blue-800">
                        <span className="font-medium">✏️ ใช้ราคาน้ำมันที่กำหนดเอง:</span> {currentOilPrice.toFixed(2)} บาท/ลิตร
                        <span className="text-blue-500 text-xs ml-1">(ใช้คำนวณเฉพาะรอบนี้)</span>
                      </div>
                      <button onClick={handleClearManualPrice} className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 border border-red-200 rounded hover:bg-red-50">✕ กลับใช้ราคาจากระบบ</button>
                    </div>
                  )}
                  {!showOilPriceForm ? (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setShowOilPriceForm(true); setManualPrice(''); }} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition">✏️ ใส่ราคาน้ำมันดีเซล</button>
                      {liveOilPrice !== null && liveOilPrice !== currentOilPrice && (
                        <button onClick={() => setCurrentOilPrice(liveOilPrice)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition">🔄 ใช้ราคาล่าสุดจากปตท. ({liveOilPrice.toFixed(2)} บาท)</button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                      <h3 className="font-bold text-amber-800">✏️ ใส่ราคาน้ำมันดีเซล</h3>
                      <p className="text-xs text-amber-600">⚠️ ราคานี้จะใช้คำนวณเฉพาะรอบนี้เท่านั้น</p>
                      <div>
                        <label className="text-xs text-gray-600 font-medium">ราคา (บาท/ลิตร)</label>
                        <input type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} inputMode="decimal" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none" placeholder="เช่น 42.25" min="0.01" max="200" step="0.01" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleApplyManualPrice} disabled={!manualPrice} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 transition">✅ ใช้คำนวณ</button>
                        <button onClick={() => setShowOilPriceForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition">ยกเลิก</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ===== Distance Lookup Section (NEW) ===== */}
            <DistanceLookup
              onApplyDistance={handleApplyDistance}
              distanceRef={distanceLookupRef}
              resetTrigger={resetTrigger}
            />

            {/* Price Calculator Card */}
            <section className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4">
                <h2 className="text-lg font-bold">💰 คำนวณราคาค่าขนส่ง</h2>
                <p className="text-slate-300 text-sm">เลือกประเภทรถ ระยะทาง และดูราคาอัตโนมัติ</p>
              </div>
              <div className="p-4 space-y-4">
                {/* Job Selection */}
                <div>
                  <label className="text-xs text-gray-500 font-medium">ประเภทรถ / งาน</label>
                  <select
                    value={selectedJob}
                    onChange={(e) => handleJobChange(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-slate-500 focus:outline-none bg-white"
                  >
                    {availableJobs.map((job) => (
                      <option key={job} value={job}>{job}</option>
                    ))}
                  </select>
                </div>

                {/* Distance Input with lookup link */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500 font-medium">ระยะทาง (กม.)</label>
                    <button
                      onClick={scrollToDistanceLookup}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      🗺️ ค้นหาระยะทาง
                    </button>
                  </div>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    inputMode="decimal"
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-slate-500 focus:outline-none"
                    placeholder="เช่น 150"
                    min="1"
                    step="0.1"
                  />
                  {routeDescription && (
                    <p className="text-xs text-blue-600 mt-1">🛣️ {routeDescription}</p>
                  )}
                </div>

                {/* Oil Price Display */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">ราคาน้ำมันดีเซล</span>
                    <span className="font-bold text-emerald-600">{currentOilPrice.toFixed(2)} บาท/ลิตร</span>
                  </div>
                </div>

                {/* Labor Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="labor"
                    checked={includeLabor}
                    onChange={(e) => setIncludeLabor(e.target.checked)}
                    className="w-4 h-4 accent-slate-700"
                  />
                  <label htmlFor="labor" className="text-sm text-gray-700">
                    เพิ่มค่าแรง ({LABOR_COST.toLocaleString()} บาท/เที่ยว)
                  </label>
                </div>

                {/* Price Result */}
                {calculatedPrice !== null && (
                  <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-6 border-2 border-slate-200">
                    <div className="text-center">
                      <p className="text-gray-600 text-sm">ราคาค่าขนส่ง</p>
                      <p className="text-4xl font-bold text-slate-800 mt-1">
                        {calculatedPrice.toLocaleString()} บาท
                      </p>
                      {includeLabor && (
                        <p className="text-sm text-slate-500 mt-2">
                          + ค่าแรง {LABOR_COST.toLocaleString()} บาท = <span className="font-bold text-slate-800">{(calculatedPrice + LABOR_COST).toLocaleString()} บาท</span>
                        </p>
                      )}
                    </div>
                    {priceDetails && (
                      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-500">ช่วงราคาน้ำมัน:</div>
                        <div className="text-gray-700 font-medium">{priceDetails.oilRange}</div>
                        <div className="text-gray-500">ช่วงระยะทาง:</div>
                        <div className="text-gray-700 font-medium">{priceDetails.distRange}</div>
                        <div className="text-gray-500">ประเภทรถ:</div>
                        <div className="text-gray-700 font-medium">{selectedJob}</div>
                        {routeDescription && (
                          <>
                            <div className="text-gray-500">เส้นทาง:</div>
                            <div className="text-gray-700 font-medium">{routeDescription}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Reset All Button */}
            <button onClick={resetAllData} className="w-full bg-red-100 text-red-700 py-3 rounded-lg font-medium hover:bg-red-200 border border-red-200">🔄 รีเซ็ตข้อมูลทั้งหมด</button>
          </div>
        )}

        {/* ===== Multi-Trip Calculator Tab ===== */}
        {activeTab === 'multitrip' && (
          <div className="space-y-6">
            {/* Distance & Oil Price Quick Settings */}
            <section className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-6 py-4">
                <h2 className="text-lg font-bold">⚙️ ตั้งค่าการคำนวณ</h2>
                <p className="text-violet-100 text-sm">ระบุระยะทางและเลือกตัวเลือกเพิ่มเติม</p>
              </div>
              <div className="p-4 space-y-4">
                {/* Distance Input */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500 font-medium">ระยะทาง (กม.)</label>
                    <button
                      onClick={() => setActiveTab('price')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      🗺️ ไปค้นหาระยะทาง
                    </button>
                  </div>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    inputMode="decimal"
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-violet-500 focus:outline-none"
                    placeholder="เช่น 150"
                    min="1"
                    step="0.1"
                  />
                  {routeDescription && (
                    <p className="text-xs text-blue-600 mt-1">🛣️ {routeDescription}</p>
                  )}
                </div>

                {/* Oil Price Display */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">ราคาน้ำมันดีเซล</span>
                    <span className="font-bold text-violet-600">{currentOilPrice.toFixed(2)} บาท/ลิตร</span>
                  </div>
                </div>

                {/* Labor Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="multitrip-labor"
                    checked={includeLabor}
                    onChange={(e) => setIncludeLabor(e.target.checked)}
                    className="w-4 h-4 accent-violet-700"
                  />
                  <label htmlFor="multitrip-labor" className="text-sm text-gray-700">
                    เพิ่มค่าแรง ({LABOR_COST.toLocaleString()} บาท/เที่ยว)
                  </label>
                </div>
              </div>
            </section>

            {/* Multi-Trip Calculator Component */}
            <MultiTripCalculator
              cargoItems={cargoItems}
              distance={parseFloat(distance) || 0}
              oilPrice={currentOilPrice}
              rateData={rateData}
              includeLabor={includeLabor}
            />
          </div>
        )}
      </main>

      {/* Image Popup */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowPopup(false)}>
          <div className="relative max-w-2xl w-full bg-white rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPopup(false)} className="absolute top-2 right-2 bg-white/80 text-gray-800 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold hover:bg-white z-10">✕</button>
            <div className="relative w-full h-[60vh]">
              <Image src={popupImage} alt="Truck details" fill className="object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 text-center py-4 px-4 mt-auto">
        <p className="text-sm">หจก.เผ่าปัญญา ทรานสปอร์ต — เครื่องมือช่วยคำนวณการขนส่ง</p>
      </footer>
    </div>
  );
}

