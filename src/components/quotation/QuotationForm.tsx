'use client';

import { useState, useCallback, useRef } from 'react';
import { truckTypes } from '@/lib/truck-data';
import { LABOR_COST } from '@/lib/oil-price-api';
import { getTodayISO } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import QuotationPreview from './QuotationPreview';
import { generatePdf } from '@/lib/quotation-pdf';
import type { CargoItem, TruckType } from '@/lib/types';

// ===== Types =====
export interface QuotationItem {
  name?: string;
  width: number;
  length: number;
  height: number;
  quantity: number;
  weight: number;
}

export interface QuotationTrip {
  id: string;
  truckTypeId: string;
  truckName: string;
  truckCBM: number;
  truckMaxWeight: number;
  distance: number;
  dieselPrice: number;
  basePrice: number;
  laborCost: number;
  tripTotalPrice: number;
  numberOfTrips: number;
  items: QuotationItem[];
}

export interface QuotationData {
  quotationNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  origin: string;
  destination: string;
  expiryDays: number;
  notes: string;
  trips: QuotationTrip[];
  totalPrice: number;
  createdAt: string;
}

interface QuotationFormProps {
  // Current app state to pre-fill
  selectedJob: string;
  distance: string;
  currentOilPrice: number;
  calculatedPrice: number | null;
  rateData: Record<string, { oil_ranges: { min: number; max: number }[]; data: { dist_min: number; dist_max: number; prices: number[] }[] }> | null;
  availableJobs: string[];
  selectedTruck: TruckType;
  cargoItems: CargoItem[];
  includeLabor: boolean;
  adminApiKey: string;
  // Route info from distance lookup
  originName?: string;
  destinationName?: string;
}

const EXPIRY_OPTIONS = [
  { value: 3, label: '3 วัน' },
  { value: 7, label: '7 วัน (ค่าเริ่มต้น)' },
  { value: 14, label: '14 วัน' },
  { value: 30, label: '30 วัน' },
];

/** สร้างเลขที่ใบเสนอราคา (ไม่ใช้ database) */
function generateLocalQuotationNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `QT-${year}-${month}${day}-${random}`;
}

/** Encode QuotationData เป็น base64 URL-safe string */
function encodeQuotationData(data: QuotationData): string {
  const json = JSON.stringify(data);
  if (typeof window !== 'undefined') {
    return btoa(unescape(encodeURIComponent(json)));
  }
  return Buffer.from(json).toString('base64');
}

/** Decode base64 URL-safe string เป็น QuotationData */
export function decodeQuotationData(encoded: string): QuotationData | null {
  try {
    let json: string;
    if (typeof window !== 'undefined') {
      json = decodeURIComponent(escape(atob(encoded)));
    } else {
      json = Buffer.from(encoded, 'base64').toString('utf-8');
    }
    return JSON.parse(json) as QuotationData;
  } catch {
    return null;
  }
}

export default function QuotationForm({
  selectedJob,
  distance,
  currentOilPrice,
  calculatedPrice,
  rateData,
  availableJobs,
  selectedTruck,
  cargoItems,
  includeLabor,
  adminApiKey,
  originName,
  destinationName,
}: QuotationFormProps) {
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  // ===== Form State =====
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [origin, setOrigin] = useState(originName || '');
  const [destination, setDestination] = useState(destinationName || '');
  const [expiryDays, setExpiryDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [trips, setTrips] = useState<QuotationTrip[]>(() => {
    if (calculatedPrice !== null) {
      const price = calculatedPrice || 0;
      const labor = includeLabor ? LABOR_COST : 0;
      return [{
        id: crypto.randomUUID(),
        truckTypeId: selectedTruck.id,
        truckName: selectedTruck.name,
        truckCBM: selectedTruck.cbm,
        truckMaxWeight: selectedTruck.maxWeight,
        distance: parseFloat(distance) || 0,
        dieselPrice: currentOilPrice,
        basePrice: price,
        laborCost: labor,
        tripTotalPrice: (price + labor),
        numberOfTrips: 1,
        items: cargoItems.filter(item => item.width > 0 && item.length > 0 && item.height > 0 && item.weight > 0).map(item => ({
          width: item.width,
          length: item.length,
          height: item.height,
          quantity: item.quantity,
          weight: item.weight,
        })),
      }];
    }
    return [];
  });
  const [quotationNumber, setQuotationNumber] = useState(generateLocalQuotationNumber);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  // ===== Convert cargoItems to QuotationItem[] =====
  const cargoToQuotationItems = useCallback((): QuotationItem[] => {
    return cargoItems
      .filter(item => item.width > 0 && item.length > 0 && item.height > 0 && item.weight > 0)
      .map(item => ({
        width: item.width,
        length: item.length,
        height: item.height,
        quantity: item.quantity,
        weight: item.weight,
      }));
  }, [cargoItems]);

  // ===== Pre-fill trip from current app state =====
  const prefillTripFromState = useCallback(() => {
    const price = calculatedPrice || 0;
    const labor = includeLabor ? LABOR_COST : 0;
    const trip: QuotationTrip = {
      id: crypto.randomUUID(),
      truckTypeId: selectedTruck.id,
      truckName: selectedTruck.name,
      truckCBM: selectedTruck.cbm,
      truckMaxWeight: selectedTruck.maxWeight,
      distance: parseFloat(distance) || 0,
      dieselPrice: currentOilPrice,
      basePrice: price,
      laborCost: labor,
      tripTotalPrice: (price + labor),
      numberOfTrips: 1,
      items: cargoToQuotationItems(),
    };
    return trip;
  }, [selectedTruck, distance, currentOilPrice, calculatedPrice, includeLabor, cargoToQuotationItems]);

  // ===== Trip Management =====
  const addTrip = () => {
    const newTrip: QuotationTrip = {
      id: crypto.randomUUID(),
      truckTypeId: truckTypes[0].id,
      truckName: truckTypes[0].name,
      truckCBM: truckTypes[0].cbm,
      truckMaxWeight: truckTypes[0].maxWeight,
      distance: 0,
      dieselPrice: currentOilPrice,
      basePrice: 0,
      laborCost: 0,
      tripTotalPrice: 0,
      numberOfTrips: 1,
      items: [],
    };
    setTrips([...trips, newTrip]);
  };

  const removeTrip = (id: string) => {
    if (trips.length > 1) {
      setTrips(trips.filter(t => t.id !== id));
    }
  };

  const updateTrip = (id: string, field: keyof QuotationTrip, value: string | number) => {
    setTrips(trips.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: value };

      if (field === 'truckTypeId') {
        const truck = truckTypes.find(tr => tr.id === value);
        if (truck) {
          updated.truckName = truck.name;
          updated.truckCBM = truck.cbm;
          updated.truckMaxWeight = truck.maxWeight;
        }
      }

      if (['basePrice', 'laborCost', 'numberOfTrips'].includes(field)) {
        const numTrips = field === 'numberOfTrips' ? Number(value) || 1 : updated.numberOfTrips;
        updated.numberOfTrips = numTrips;
        updated.tripTotalPrice = (updated.basePrice + updated.laborCost) * numTrips;
      }

      return updated;
    }));
  };

  // Calculate price for a trip using rate data
  const calculateTripPrice = (trip: QuotationTrip): number => {
    if (!rateData || trip.distance <= 0) return 0;

    const truck = truckTypes.find(t => t.id === trip.truckTypeId);
    const jobKey = truck?.jobKey || selectedJob;
    const jobData = rateData[jobKey];
    if (!jobData) return 0;

    let oilIndex = -1;
    for (let i = 0; i < jobData.oil_ranges.length; i++) {
      const range = jobData.oil_ranges[i];
      if (trip.dieselPrice >= range.min && trip.dieselPrice <= range.max) {
        oilIndex = i;
        break;
      }
    }
    if (oilIndex === -1) oilIndex = jobData.oil_ranges.length - 1;

    let distIndex = -1;
    if (jobData.data && jobData.data.length > 0) {
      for (let i = 0; i < jobData.data.length; i++) {
        const row = jobData.data[i];
        if (trip.distance >= row.dist_min && trip.distance <= row.dist_max) {
          distIndex = i;
          break;
        }
      }
      if (distIndex === -1) {
        if (trip.distance < jobData.data[0].dist_min) {
          distIndex = 0;
        } else {
          distIndex = jobData.data.length - 1;
        }
      }
    }

    if (distIndex >= 0 && jobData.data[distIndex]?.prices?.[oilIndex] !== undefined) {
      return jobData.data[distIndex].prices[oilIndex];
    }
    return 0;
  };

  const recalculateTripPrice = (id: string) => {
    setTrips(prevTrips => prevTrips.map(t => {
      if (t.id !== id) return t;
      const basePrice = calculateTripPrice(t);
      const totalPrice = (basePrice + t.laborCost) * t.numberOfTrips;
      return { ...t, basePrice, tripTotalPrice: totalPrice };
    }));
  };

  // ===== Total Price =====
  const totalPrice = trips.reduce((sum, t) => sum + t.tripTotalPrice, 0);

  // ===== Build preview data =====
  const buildPreviewData = (): QuotationData => ({
    quotationNumber,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    origin,
    destination,
    expiryDays,
    notes,
    trips,
    totalPrice,
    createdAt: getTodayISO(),
  });

  // ===== Preview =====
  const handlePreview = () => {
    if (!customerName.trim() || !origin.trim() || !destination.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลที่จำเป็น', description: 'ชื่อลูกค้า, ต้นทาง, ปลายทาง', variant: 'destructive' });
      return;
    }
    setShowPreview(true);
    setShareLink(null);
  };

  // ===== Generate PDF =====
  const handleGeneratePdf = async () => {
    if (!previewRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await generatePdf(previewRef.current, `${quotationNumber}.pdf`);
      toast({ title: 'สร้าง PDF สำเร็จ' });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: 'สร้าง PDF ไม่สำเร็จ', description: 'กรุณาลองอีกครั้ง', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ===== Generate Share Link =====
  const handleGenerateShareLink = () => {
    const data = buildPreviewData();
    const encoded = encodeQuotationData(data);
    const link = `${window.location.origin}/quotation?q=${encoded}`;
    setShareLink(link);
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: 'คัดลอกลิงก์สำเร็จ', description: link });
    }).catch(() => {
      toast({ title: 'ลิงก์พร้อมแชร์แล้ว', description: 'คัดลอกลิงก์ด้านล่างส่งให้ลูกค้า' });
    });
  };

  // ===== Copy Share Link =====
  const copyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(() => {
      toast({ title: 'คัดลอกลิงก์สำเร็จ' });
    }).catch(() => {
      toast({ title: 'คัดลอกไม่สำเร็จ', variant: 'destructive' });
    });
  };

  // ===== Reset form =====
  const resetForm = () => {
    setShowPreview(false);
    setShareLink(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setOrigin('');
    setDestination('');
    setExpiryDays(7);
    setNotes('');
    setTrips([]);
    setQuotationNumber(generateLocalQuotationNumber());
  };

  // ===== If preview is showing, render the preview =====
  if (showPreview) {
    const previewData = buildPreviewData();
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 no-print">
          <button
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition text-sm disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                กำลังสร้าง PDF...
              </span>
            ) : (
              '📄 ดาวน์โหลด PDF'
            )}
          </button>
          <button
            onClick={handleGenerateShareLink}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition text-sm"
          >
            🔗 แชร์ลิงก์ให้ลูกค้า
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition text-sm"
          >
            🖨️ พิมพ์
          </button>
          <button
            onClick={resetForm}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition text-sm"
          >
            ➕ สร้างใหม่
          </button>
        </div>

        {/* Share link display */}
        {shareLink && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 no-print">
            <p className="text-sm text-emerald-700 font-medium mb-1">ลิงก์แชร์สำหรับลูกค้า:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 bg-white border border-emerald-300 rounded px-2 py-1 text-xs text-gray-700 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button onClick={copyShareLink} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700">
                คัดลอก
              </button>
            </div>
            <p className="text-xs text-emerald-600 mt-1">ส่งลิงก์นี้ให้ลูกค้าเปิดดูใบเสนอราคาได้เลย</p>
          </div>
        )}

        <div ref={previewRef}>
          <QuotationPreview quotation={previewData} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quotation Number + Status */}
      <section className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-700 to-purple-800 text-white px-6 py-4">
          <h2 className="text-lg font-bold">📄 สร้างใบเสนอราคา</h2>
          <p className="text-purple-200 text-sm">กรอกข้อมูลเพื่อสร้างใบเสนอราคาสำหรับลูกค้า</p>
        </div>

        <div className="p-4 space-y-5">
          {/* Quotation Number */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-purple-600 font-medium">เลขที่ใบเสนอราคา</span>
              <p className="text-lg font-bold text-purple-800">{quotationNumber}</p>
            </div>
            <button
              onClick={() => setQuotationNumber(generateLocalQuotationNumber())}
              className="text-xs text-purple-500 bg-purple-100 px-2 py-1 rounded hover:bg-purple-200 transition"
              title="สุ่มเลขใหม่"
            >
              สุ่มใหม่
            </button>
          </div>

          {/* Customer Section */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">👤 ข้อมูลลูกค้า</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 font-medium">ชื่อลูกค้า *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
                  placeholder="ชื่อ-นามสกุล / ชื่อบริษัท"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">เบอร์โทร</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
                  placeholder="08x-xxx-xxxx"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">อีเมล</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
                  placeholder="email@example.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 font-medium">ที่อยู่</label>
                <textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="ที่อยู่สำหรับออกเอกสาร"
                />
              </div>
            </div>
          </div>

          {/* Route Section */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">🛣️ เส้นทาง</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">ต้นทาง *</label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
                  placeholder="จุดรับสินค้า"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">ปลายทาง *</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
                  placeholder="จุดส่งสินค้า"
                />
              </div>
            </div>
          </div>

          {/* Trips Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">🚚 รายการเที่ยวขนส่ง</h3>
              <button
                onClick={addTrip}
                className="text-sm px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium transition"
              >
                + เพิ่มเที่ยว
              </button>
            </div>

            {trips.length === 0 && (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500 text-sm">ยังไม่มีรายการเที่ยวขนส่ง</p>
                <p className="text-gray-400 text-xs mt-1">กด &quot;+ เพิ่มเที่ยว&quot; หรือคำนวณราคาในแท็บ &quot;คำนวณราคา&quot; ก่อน</p>
                <button
                  onClick={() => setTrips([prefillTripFromState()])}
                  className="mt-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
                >
                  ใช้ข้อมูลจากแท็บคำนวณราคา
                </button>
              </div>
            )}

            {trips.map((trip, index) => (
              <div key={trip.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-800 bg-purple-100 px-3 py-1 rounded text-sm">
                    เที่ยวที่ {index + 1}
                  </span>
                  {trips.length > 1 && (
                    <button
                      onClick={() => removeTrip(trip.id)}
                      className="text-red-500 hover:text-red-700 font-medium text-sm"
                    >
                      ✕ ลบ
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">ประเภทรถ</label>
                    <select
                      value={trip.truckTypeId}
                      onChange={(e) => {
                        updateTrip(trip.id, 'truckTypeId', e.target.value);
                        setTimeout(() => recalculateTripPrice(trip.id), 50);
                      }}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none text-sm"
                    >
                      {truckTypes.map(truck => (
                        <option key={truck.id} value={truck.id}>{truck.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">ระยะทาง (กม.)</label>
                    <input
                      type="number"
                      value={trip.distance || ''}
                      onChange={(e) => {
                        updateTrip(trip.id, 'distance', parseFloat(e.target.value) || 0);
                        setTimeout(() => recalculateTripPrice(trip.id), 50);
                      }}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">ราคา/เที่ยว (บาท)</label>
                    <input
                      type="number"
                      value={trip.basePrice || ''}
                      onChange={(e) => updateTrip(trip.id, 'basePrice', parseFloat(e.target.value) || 0)}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">จำนวนเที่ยว</label>
                    <input
                      type="number"
                      value={trip.numberOfTrips}
                      onChange={(e) => updateTrip(trip.id, 'numberOfTrips', parseInt(e.target.value) || 1)}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none text-sm"
                      min="1"
                    />
                  </div>
                </div>

                {/* Items summary */}
                {trip.items.length > 0 && (
                  <div className="mt-3 bg-white rounded-lg p-2 border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">📦 รายการสินค้า ({trip.items.length} รายการ)</p>
                    <div className="space-y-0.5 max-h-20 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {trip.items.map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-600 flex gap-1">
                          <span className="text-gray-400">{idx + 1}.</span>
                          <span>{item.width}×{item.length}×{item.height} ซม. × {item.quantity} ชิ้น ({item.weight} kg)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trip summary */}
                <div className="mt-3 flex items-center justify-between bg-white rounded-lg p-2 border">
                  <div className="text-xs text-gray-500">
                    ราคา/เที่ยว: {trip.basePrice.toLocaleString()} บาท
                    {trip.laborCost > 0 && ` (+ค่าแรง ${trip.laborCost.toLocaleString()})`}
                    {' × '}{trip.numberOfTrips} เที่ยว
                  </div>
                  <div className="text-sm font-bold text-purple-700">
                    {trip.tripTotalPrice.toLocaleString()} บาท
                  </div>
                </div>
              </div>
            ))}

            {/* Total */}
            {trips.length > 0 && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 text-center">
                <p className="text-sm text-purple-600">ราคารวมทั้งหมด</p>
                <p className="text-3xl font-bold text-purple-800">{totalPrice.toLocaleString()} บาท</p>
              </div>
            )}
          </div>

          {/* Other Settings */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">⚙️ ตั้งค่าอื่นๆ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">วันหมดอายุ</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
                >
                  {EXPIRY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">หมายเหตุ</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                />
              </div>
            </div>
          </div>

          {/* Preview + Submit */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handlePreview}
              className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition"
            >
              👁️ ดูตัวอย่าง
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}