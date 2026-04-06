'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface OilPrice {
  date: string;
  price: number;
}

interface RateData {
  [key: string]: {
    oil_ranges: { min: number; max: number }[];
    data: { dist_min: number; dist_max: number; prices: number[] }[];
  };
}

interface TruckType {
  id: string;
  name: string;
  image: string;
  cbm: number;
  maxWeight: number;
  dimensions: { width: number; length: number; height: number };
  usableSpace: number;
  jobKey: string;
}

interface CargoItem {
  id: string;
  width: number;
  length: number;
  height: number;
  quantity: number;
  weight: number;
}

const truckTypes: TruckType[] = [
  {
    id: 'pickup',
    name: 'รถกระบะตู้ทึบ',
    image: '/images/Screenshot_20260320_125706_OneDrive.jpg',
    cbm: 6,
    maxWeight: 1500,
    dimensions: { width: 1.65, length: 2.30, height: 2.0 },
    usableSpace: 80,
    jobKey: '4ล้อ_PPY',
  },
  {
    id: 'jumbo',
    name: 'รถ 4 ล้อจัมโบ้',
    image: '/images/Screenshot_20260320_125652_OneDrive.jpg',
    cbm: 11,
    maxWeight: 3000,
    dimensions: { width: 1.80, length: 3.20, height: 2.10 },
    usableSpace: 100,
    jobKey: '4จัมโบ้_PPY',
  },
  {
    id: '6wheel',
    name: 'รถ 6 ล้อ',
    image: '/images/Screenshot_20260320_125638_OneDrive.jpg',
    cbm: 32,
    maxWeight: 6000,
    dimensions: { width: 2.40, length: 6.60, height: 2.35 },
    usableSpace: 90,
    jobKey: '6ล้อ_PPY',
  },
];

const FALLBACK_OIL_PRICE = 33.50;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'cbm' | 'price'>('cbm');
  const [currentOilPrice, setCurrentOilPrice] = useState<number>(FALLBACK_OIL_PRICE);
  const [oilPriceHistory, setOilPriceHistory] = useState<OilPrice[]>([]);
  const [loadingOil, setLoadingOil] = useState(true);
  const [oilPriceSource, setOilPriceSource] = useState<string>('');
  
  const [selectedJob, setSelectedJob] = useState<string>('4ล้อ_PPY');
  const [distance, setDistance] = useState<string>('');
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [priceDetails, setPriceDetails] = useState<{ oilRange: string; distRange: string } | null>(null);
  
  const [selectedTruck, setSelectedTruck] = useState(truckTypes[0]);
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
  ]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupImage, setPopupImage] = useState('');
  
  const [rateData, setRateData] = useState<RateData | null>(null);
  const [availableJobs, setAvailableJobs] = useState<string[]>([]);

  useEffect(() => {
    fetch('/transport_rates.json')
      .then(res => res.json())
      .then(data => {
        setRateData(data);
        const keys = Object.keys(data);
        setAvailableJobs(keys);
        if (keys.length > 0) setSelectedJob(keys[0]);
      })
      .catch(() => console.error('Failed to load rate data'));
  }, []);

  const fetchOilPrice = useCallback(async () => {
    setLoadingOil(true);
    try {
      const res = await fetch('/api/oil-price');
      const data = await res.json();
      
      if (data.price !== undefined && data.price !== null) {
        setCurrentOilPrice(data.price);
        setOilPriceSource(data.source || 'api');
        if (data.history && data.history.length > 0) {
          setOilPriceHistory(data.history);
        }
      }
    } catch {
      console.error('Failed to fetch oil price');
    } finally {
      setLoadingOil(false);
    }
  }, []);

  useEffect(() => {
    fetchOilPrice();
  }, [fetchOilPrice]);

  useEffect(() => {
    if (!rateData || !distance || currentOilPrice === null) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    const jobData = rateData[selectedJob];
    if (!jobData) return;

    const dist = parseFloat(distance);
    if (isNaN(dist) || dist <= 0) return;

    let oilIndex = jobData.oil_ranges.findIndex(
      range => currentOilPrice >= range.min && currentOilPrice <= range.max
    );
    if (oilIndex === -1) oilIndex = jobData.oil_ranges.length - 1;

    let distIndex = -1;
    let distRange = '';
    
    for (let i = 0; i < jobData.data.length; i++) {
      const row = jobData.data[i];
      if (dist >= row.dist_min && dist <= row.dist_max) {
        distIndex = i;
        distRange = `${row.dist_min} - ${row.dist_max} กม.`;
        break;
      }
    }
    
    if (distIndex === -1) {
      distIndex = jobData.data.length - 1;
      distRange = `${jobData.data[distIndex].dist_min}+ กม.`;
    }

    if (jobData.data[distIndex]?.prices?.[oilIndex] !== undefined) {
      setCalculatedPrice(jobData.data[distIndex].prices[oilIndex]);
      setPriceDetails({
        oilRange: `${jobData.oil_ranges[oilIndex].min} - ${jobData.oil_ranges[oilIndex].max} บาท`,
        distRange
      });
    }
  }, [rateData, selectedJob, distance, currentOilPrice]);

  const goToPriceCalculator = (truck: TruckType) => {
    setSelectedTruck(truck);
    setSelectedJob(truck.jobKey);
    setActiveTab('price');
  };

  const calculateCBM = (item: CargoItem) => 
    ((item.width * item.length * item.height) / 1000000) * item.quantity;

  const totalCBM = cargoItems.reduce((sum, item) => sum + calculateCBM(item), 0);
  const totalWeight = cargoItems.reduce((sum, item) => sum + item.weight * item.quantity, 0);

  const canFitInTruck = (item: CargoItem, truck: TruckType) => {
    const dims = [item.width, item.length, item.height];
    const truckDims = [truck.dimensions.width * 100, truck.dimensions.length * 100, truck.dimensions.height * 100];
    
    for (let i = 0; i < 6; i++) {
      const [w, l, h] = [
        dims[i % 3], dims[(i + 1) % 3], dims[(i + 2) % 3]
      ];
      if (w <= truckDims[0] && l <= truckDims[1] && h <= truckDims[2]) return true;
    }
    return false;
  };

  const getOversizedDimensions = (item: CargoItem, truck: TruckType) => {
    const issues: string[] = [];
    if (item.width > truck.dimensions.width * 100) issues.push(`กว้าง ${item.width} cm`);
    if (item.length > truck.dimensions.length * 100) issues.push(`ยาว ${item.length} cm`);
    if (item.height > truck.dimensions.height * 100) issues.push(`สูง ${item.height} cm`);
    return issues;
  };

  const allItemsValid = cargoItems.every(item => 
    item.width > 0 && item.length > 0 && item.height > 0 && item.weight > 0
  );

  const addCargoItem = () => {
    setCargoItems([...cargoItems, { id: Date.now().toString(), width: 0, length: 0, height: 0, quantity: 1, weight: 0 }]);
  };

  const removeCargoItem = (id: string) => {
    if (cargoItems.length > 1) {
      setCargoItems(cargoItems.filter(item => item.id !== id));
    }
  };

  const updateCargoItem = (id: string, field: keyof CargoItem, value: number) => {
    setCargoItems(cargoItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const resetForm = () => {
    setCargoItems([{ id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 }]);
    setSelectedTruck(truckTypes[0]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-4 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Image src="/images/3_20251016_054221_0002.png" alt="Logo" width={60} height={60} className="rounded-full" />
          <div>
            <h1 className="text-xl font-bold">หจก.เผ่าปัญญา ทรานสปอร์ต</h1>
            <p className="text-blue-200 text-sm">เครื่องมือช่วยคำนวณการขนส่ง</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-2 bg-white rounded-lg shadow p-1">
          <button onClick={() => setActiveTab('cbm')} className={`flex-1 py-3 px-4 rounded-lg font-medium ${activeTab === 'cbm' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            📦 คำนวณ CBM
          </button>
          <button onClick={() => setActiveTab('price')} className={`flex-1 py-3 px-4 rounded-lg font-medium ${activeTab === 'price' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            💰 คำนวณราคา
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'cbm' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🚛 เลือกประเภทรถ</h2>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {truckTypes.map(truck => (
                  <div key={truck.id} onClick={() => setSelectedTruck(truck)} className={`rounded-xl border-2 cursor-pointer ${selectedTruck.id === truck.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="relative h-48 overflow-hidden">
                      <Image src={truck.image} alt={truck.name} fill className="object-cover object-top" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold">{truck.name}</h3>
                      <p className="text-sm text-gray-600">CBM: {truck.cbm} | {truck.maxWeight.toLocaleString()} kg</p>
                      <button onClick={(e) => { e.stopPropagation(); goToPriceCalculator(truck); }} className="mt-2 w-full py-2 bg-green-500 text-white rounded-lg text-sm">
                        💰 คำนวณราคา
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 flex justify-between">
                <h2 className="text-lg font-bold">📦 รายการสินค้า</h2>
                <button onClick={addCargoItem} className="bg-white text-orange-600 px-3 py-1 rounded-lg text-sm">+ เพิ่ม</button>
              </div>
              <div className="p-4 space-y-4">
                {cargoItems.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between mb-3">
                      <span className="font-medium">รายการ {index + 1}</span>
                      {cargoItems.length > 1 && <button onClick={() => removeCargoItem(item.id)} className="text-red-500">✕</button>}
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      {['width', 'length', 'height', 'quantity', 'weight'].map((field, i) => (
                        <div key={field}>
                          <label className="text-xs text-gray-500">{['กว้าง', 'ยาว', 'สูง', 'จำนวน', 'น้ำหนัก'][i]} *</label>
                          <input type="number" value={item[field as keyof CargoItem] || ''} onChange={e => updateCargoItem(item.id, field as keyof CargoItem, parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1" />
                        </div>
                      ))}
                    </div>
                    {item.width > 0 && item.length > 0 && item.height > 0 && (
                      <p className="text-sm text-blue-600 mt-2">CBM: {calculateCBM(item).toFixed(4)} m³</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {totalCBM > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold mb-4">📊 ผลการตรวจสอบ</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 p-4 rounded text-center">
                    <p className="text-gray-600 text-sm">ปริมาตร</p>
                    <p className="text-2xl font-bold text-blue-600">{totalCBM.toFixed(4)} m³</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded text-center">
                    <p className="text-gray-600 text-sm">น้ำหนัก</p>
                    <p className="text-2xl font-bold text-orange-600">{totalWeight.toLocaleString()} kg</p>
                  </div>
                </div>
                {!allItemsValid && <p className="text-yellow-700">⚠️ กรุณากรอกข้อมูลให้ครบ</p>}
                {allItemsValid && !cargoItems.every(i => canFitInTruck(i, selectedTruck)) && (
                  <p className="text-red-700">❌ สินค้ามีขนาดใหญ่เกินไป</p>
                )}
                {allItemsValid && cargoItems.every(i => canFitInTruck(i, selectedTruck)) && totalCBM <= selectedTruck.cbm * 0.8 && totalWeight <= selectedTruck.maxWeight && (
                  <p className="text-green-700">✅ ใส่รถ {selectedTruck.name} ได้!</p>
                )}
              </div>
            )}

            <button onClick={resetForm} className="w-full py-3 bg-gray-200 rounded-lg">🔄 รีเซ็ต</button>
          </div>
        )}

        {activeTab === 'price' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">⛽ ราคาน้ำมันดีเซล</h2>
                <span className="text-xs bg-green-700 px-2 py-0.5 rounded">{oilPriceSource || 'loading'}</span>
              </div>
              <div className="p-4">
                {loadingOil ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-2">กำลังโหลด...</p>
                  </div>
                ) : oilPriceHistory.length > 0 ? (
                  <table className="w-full">
                    <thead><tr className="bg-gray-50"><th className="text-left py-2 px-3">วันที่</th><th className="text-right py-2 px-3">ราคา (บาท)</th></tr></thead>
                    <tbody>
                      {oilPriceHistory.map((item, i) => (
                        <tr key={item.date} className={`border-b ${i === 0 ? 'bg-blue-50 font-bold' : ''}`}>
                          <td className="py-2 px-3">{item.date} {i === 0 && <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">ใช้คำนวณ</span>}</td>
                          <td className="py-2 px-3 text-right">{item.price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-3xl font-bold text-orange-600">{currentOilPrice.toFixed(2)} บาท</p>
                    <button onClick={fetchOilPrice} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">🔄 โหลดใหม่</button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold mb-4">🧮 คำนวณราคาค่าขนส่ง</h3>
              <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)} className="w-full border-2 rounded-lg px-4 py-3 mb-4">
                {availableJobs.map(job => <option key={job} value={job}>{job}</option>)}
              </select>
              <div className="flex gap-2 mb-4">
                <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="ระยะทาง" className="flex-1 border-2 rounded-lg px-4 py-3" />
                <span className="text-gray-600 self-center">กม.</span>
              </div>
              {calculatedPrice !== null && priceDetails && (
                <div className="bg-blue-50 rounded-xl p-6 text-center">
                  <p className="text-4xl font-bold text-blue-600">฿{calculatedPrice.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-2">น้ำมัน: {priceDetails.oilRange} | ระยะทาง: {priceDetails.distRange}</p>
                </div>
              )}
            </div>

            <button onClick={() => setActiveTab('cbm')} className="w-full py-3 bg-gray-200 rounded-lg">📦 กลับไปคำนวณ CBM</button>
          </div>
        )}
      </main>

      {showPopup && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50" onClick={() => setShowPopup(false)}>
          <Image src={popupImage} alt="Truck" width={800} height={600} className="max-w-full max-h-[80vh] rounded-lg" />
        </div>
      )}

      <footer className="bg-gray-800 text-white py-6 px-4 mt-8 text-center">
        <p className="font-bold">หจก.เผ่าปัญญา ทรานสปอร์ต</p>
        <p className="text-gray-400 text-sm">© {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
