--- src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// Types
interface OilPrice {
  date: string;
  price: number;
}

interface RateData {
  [key: string]: {
    oil_ranges: { min: number; max: number }[];
    data: {
      dist_min: number;
      dist_max: number;
      prices: number[];
    }[];
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

// Truck Data
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

const FALLBACK_OIL_PRICE = 50.54;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'cbm' | 'price'>('cbm');

  const [currentOilPrice, setCurrentOilPrice] = useState<number>(FALLBACK_OIL_PRICE);
  const [oilPriceHistory, setOilPriceHistory] = useState<OilPrice[]>([]);
  const [loadingOil, setLoadingOil] = useState(true);

  const [selectedJob, setSelectedJob] = useState<string>('4ล้อ_PPY');
  const [distance, setDistance] = useState<string>('');
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [priceDetails, setPriceDetails] = useState<{
    oilRange: string;
    distRange: string;
  } | null>(null);

  const [selectedTruck, setSelectedTruck] = useState(truckTypes[0]);
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
  ]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupImage, setPopupImage] = useState('');

  const [rateData, setRateData] = useState<RateData | null>(null);
  const [availableJobs, setAvailableJobs] = useState<string[]>([]);

  // Load rate data
  useEffect(() => {
    fetch('/transport_rates.json')
      .then((res) => res.json())
      .then((data) => {
        setRateData(data);
        const keys = Object.keys(data);
        setAvailableJobs(keys);
        if (keys.length > 0) {
          setSelectedJob(keys[0]);
        }
      })
      .catch((err) => console.error('Failed to load rate data:', err));
  }, []);

  // Fetch oil price
  const fetchOilPrice = useCallback(async () => {
    setLoadingOil(true);

    try {
      const res = await fetch('/api/oil-price');
      const data = await res.json();

      if (data.price !== undefined && data.price !== null) {
        setCurrentOilPrice(data.price);

        if (data.history && data.history.length > 0) {
          setOilPriceHistory(data.history);
        }
      }
    } catch (error) {
      console.error('Failed to fetch oil price:', error);
    } finally {
      setLoadingOil(false);
    }
  }, []);

  useEffect(() => {
    fetchOilPrice();
  }, [fetchOilPrice]);

  // Calculate price
  useEffect(() => {
    if (!rateData || !distance || !currentOilPrice) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    const jobData = rateData[selectedJob];
    if (!jobData) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    const dist = parseFloat(distance);
    if (isNaN(dist) || dist <= 0) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    let oilIndex = -1;
    for (let i = 0; i < jobData.oil_ranges.length; i++) {
      const range = jobData.oil_ranges[i];
      if (currentOilPrice >= range.min && currentOilPrice <= range.max) {
        oilIndex = i;
        break;
      }
    }

    if (oilIndex === -1) {
      oilIndex = jobData.oil_ranges.length - 1;
    }

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

      setCalculatedPrice(price);
      setPriceDetails({ oilRange, distRange });
    } else {
      setCalculatedPrice(null);
      setPriceDetails(null);
    }
  }, [rateData, selectedJob, distance, currentOilPrice]);

  const goToPriceCalculator = (truck: TruckType) => {
    setSelectedTruck(truck);
    setSelectedJob(truck.jobKey);
    setActiveTab('price');
  };

  const calculateCBM = (item: CargoItem) => {
    return ((item.width * item.length * item.height) / 1000000) * item.quantity;
  };

  const totalCBM = cargoItems.reduce((sum, item) => sum + calculateCBM(item), 0);
  const totalWeight = cargoItems.reduce((sum, item) => sum + item.weight * item.quantity, 0);

  const canFitInTruck = (item: CargoItem, truck: TruckType) => {
    const { width, length, height } = item;
    const { width: tw, length: tl, height: th } = truck.dimensions;

    const rotations = [
      [width, length, height],
      [width, height, length],
      [length, width, height],
      [length, height, width],
      [height, width, length],
      [height, length, width],
    ];

    return rotations.some(([w, l, h]) => w <= tw * 100 && l <= tl * 100 && h <= th * 100);
  };

  const getOversizedDimensions = (item: CargoItem, truck: TruckType) => {
    const issues: string[] = [];
    const { width, length, height } = item;
    const { width: tw, length: tl, height: th } = truck.dimensions;

    if (width > tw * 100 && width > tl * 100) issues.push(`กว้าง ${width} ซม.`);
    if (length > tl * 100 && length > tw * 100) issues.push(`ยาว ${length} ซม.`);
    if (height > th * 100) issues.push(`สูง ${height} ซม.`);

    return issues;
  };

  const checkAllItemsFit = () => {
    return cargoItems.every((item) => canFitInTruck(item, selectedTruck));
  };

  const getRecommendedTruck = () => {
    for (const truck of truckTypes) {
      const fits = cargoItems.every((item) => canFitInTruck(item, truck));
      const cbmOk = totalCBM <= truck.cbm * (truck.usableSpace / 100);
      const weightOk = totalWeight <= truck.maxWeight;

      if (fits && cbmOk && weightOk) {
        return truck;
      }
    }
    return null;
  };

  const recommendedTruck = cargoItems.length > 0 && totalCBM > 0 ? getRecommendedTruck() : null;
  const allItemsValid = cargoItems.every((item) => item.width > 0 && item.length > 0 && item.height > 0 && item.weight > 0);

  const addCargoItem = () => {
    setCargoItems([
      ...cargoItems,
      { id: Date.now().toString(), width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
    ]);
  };

  const removeCargoItem = (id: string) => {
    if (cargoItems.length > 1) {
      setCargoItems(cargoItems.filter((item) => item.id !== id));
    }
  };

  const updateCargoItem = (id: string, field: keyof CargoItem, value: number) => {
    setCargoItems(
      cargoItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const resetForm = () => {
    setCargoItems([
      { id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
    ]);
    setSelectedTruck(truckTypes[0]);
  };

  const openPopup = (image: string) => {
    setPopupImage(image);
    setShowPopup(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-4 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Image
            src="/images/3_20251016_054221_0002.png"
            alt="เผ่าปัญญา ทรานสปอร์ต"
            width={60}
            height={60}
            className="rounded-full"
          />
          <div>
            <h1 className="text-xl font-bold">หจก.เผ่าปัญญา ทรานสปอร์ต</h1>
            <p className="text-blue-200 text-sm">เครื่องมือช่วยคำนวณการขนส่ง</p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-2 bg-white rounded-lg shadow p-1">
          <button
            onClick={() => setActiveTab('cbm')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'cbm'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📦 คำนวณ CBM
          </button>
          <button
            onClick={() => setActiveTab('price')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'price'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            💰 คำนวณราคา
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* CBM Calculator Tab */}
        {activeTab === 'cbm' && (
          <div className="space-y-6">
            {/* Truck Selection */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🚛 เลือกประเภทรถ</h2>
                <p className="text-blue-100 text-sm">เลือกรถแล้วกด &quot;คำนวณราคา&quot; เพื่อไปหน้าคำนวณราคาอัตโนมัติ</p>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {truckTypes.map((truck) => (
                  <div
                    key={truck.id}
                    className={`rounded-xl border-2 transition-all ${
                      selectedTruck.id === truck.id
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div
                      className="relative h-48 overflow-hidden rounded-t-xl cursor-pointer"
                      onClick={() => setSelectedTruck(truck)}
                    >
                      <Image
                        src={truck.image}
                        alt={truck.name}
                        fill
                        className="object-cover object-top"
                        style={{ objectPosition: 'top' }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPopup(truck.image);
                        }}
                        className="absolute bottom-2 left-2 bg-white text-blue-600 text-xs px-2 py-1 rounded shadow hover:bg-blue-50"
                      >
                        กดเพื่อดูข้อมูลเพิ่มเติม
                      </button>
                      {selectedTruck.id === truck.id && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-gray-800">{truck.name}</h3>
                      <p className="text-sm text-gray-600">CBM: {truck.cbm} | น้ำหนัก: {truck.maxWeight.toLocaleString()} kg</p>

                      <button
                        onClick={() => goToPriceCalculator(truck)}
                        className="mt-2 w-full py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition text-sm"
                      >
                        💰 คำนวณราคา
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cargo Items */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">📦 รายการสินค้า</h2>
                  <p className="text-yellow-100 text-xs">สามารถเลือก รายการสินค้าได้มากกว่า 1 รายการ โดยกดปุ่ม &quot;+ เพิ่มรายการ&quot; จะมีรายการเพิ่มด้านล่างอัตโนมัติ </p>
                </div>
                <button
                  onClick={addCargoItem}
                  className="bg-white text-orange-600 px-3 py-1 rounded-lg font-medium hover:bg-orange-50"
                >
                  + เพิ่มรายการ
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* แต่ละรายการอยู่คนละบรรทัด แยกกันชัดเจน */}
                {cargoItems.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 block w-full">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800 bg-blue-100 px-3 py-1 rounded">
                        รายการที่ {index + 1}
                      </span>
                      {cargoItems.length > 1 && (
                        <button
                          onClick={() => removeCargoItem(item.id)}
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          ✕ ลบรายการนี้
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-medium">กว้าง (ซม.) *</label>
                        <input
                          type="number"
                          value={item.width || ''}
                          onChange={(e) => updateCargoItem(item.id, 'width', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">ยาว (ซม.) *</label>
                        <input
                          type="number"
                          value={item.length || ''}
                          onChange={(e) => updateCargoItem(item.id, 'length', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">สูง (ซม.) *</label>
                        <input
                          type="number"
                          value={item.height || ''}
                          onChange={(e) => updateCargoItem(item.id, 'height', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">จำนวน</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCargoItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">น้ำหนัก (kg) *</label>
                        <input
                          type="number"
                          value={item.weight || ''}
                          onChange={(e) => updateCargoItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {item.width > 0 && item.length > 0 && item.height > 0 && (
                      <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium">
                          📦 CBM: {calculateCBM(item).toFixed(4)} m³
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            {totalCBM > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-4">
                  <h2 className="text-lg font-bold">📊 ผลการตรวจสอบ</h2>
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

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>การใช้พื้นที่</span>
                        <span>{((totalCBM / (selectedTruck.cbm * selectedTruck.usableSpace / 100)) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            totalCBM > selectedTruck.cbm * selectedTruck.usableSpace / 100
                              ? 'bg-red-500'
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              (totalCBM / (selectedTruck.cbm * selectedTruck.usableSpace / 100)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>การใช้น้ำหนัก</span>
                        <span>{((totalWeight / selectedTruck.maxWeight) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            totalWeight > selectedTruck.maxWeight ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min((totalWeight / selectedTruck.maxWeight) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {!allItemsValid && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800">
                      ⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง
                    </div>
                  )}

                  {allItemsValid && !checkAllItemsFit() && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-800 font-medium">❌ สินค้ามีขนาดใหญ่เกินไป</p>
                      <ul className="text-sm text-red-600 mt-1">
                        {cargoItems.map((item, idx) => {
                          const issues = getOversizedDimensions(item, selectedTruck);
                          return issues.length > 0 ? (
                            <li key={item.id}>รายการ {idx + 1}: {issues.join(', ')}</li>
                          ) : null;
                        })}
                      </ul>
                    </div>
                  )}

                  {allItemsValid && checkAllItemsFit() && totalCBM <= selectedTruck.cbm * selectedTruck.usableSpace / 100 && totalWeight <= selectedTruck.maxWeight && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <p className="text-green-800 font-bold text-lg">✅ ใส่รถ {selectedTruck.name} ได้!</p>
                    </div>
                  )}

                  {recommendedTruck && recommendedTruck.id !== selectedTruck.id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-800 font-medium">
                        💡 แนะนำ: {recommendedTruck.name}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => goToPriceCalculator(selectedTruck)}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-green-700 transition"
                  >
                    💰 ไปคำนวณราคาค่าขนส่ง
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={resetForm}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300"
            >
               รีเซ็ตข้อมูล
            </button>
          </div>
        )}

        {/* Price Calculator Tab */}
        {activeTab === 'price' && (
          <div className="space-y-6">
            {/* Oil Price Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  ⛽ ราคาน้ำมันดีเซล (ดีเซล)
                </h2>
                <p className="text-green-100 text-sm">อ้างอิง: ปตท.</p>
              </div>

              <div className="p-4">
                {loadingOil ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-2">กำลังโหลดราคาน้ำมัน...</p>
                  </div>
                ) : oilPriceHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-2 px-3 text-gray-600 font-medium w-1/4">วันที่</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-1/4">สถานะ</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-1/4">ใช้คำนวณ</th>
                          <th className="text-right py-2 px-3 text-gray-600 font-medium w-1/4">ราคา (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oilPriceHistory.map((item, index) => {
                          let statusText = '';
                          let statusColor = '';

                          if (index < oilPriceHistory.length - 1) {
                            const prevPrice = oilPriceHistory[index + 1].price;
                            const diff = item.price - prevPrice;

                            if (diff > 0) {
                              statusText = `▲ เพิ่มขึ้น`;
                              statusColor = 'text-red-500';
                            } else if (diff < 0) {
                              statusText = `▼ ลดลง`;
                              statusColor = 'text-green-500';
                            }
                          }

                          const isToday = index === 0;

                          return (
                            <tr
                              key={item.date}
                              className={`border-b ${
                                isToday ? 'bg-blue-50 font-bold' : ''
                              }`}
                            >
                              {/* Column 1: วันที่ - ชิดซ้าย */}
                              <td className="py-2 px-3 text-left text-gray-700">
                                {item.date}
                              </td>

                              {/* Column 2: สถานะปรับราคา - กลางชิดซ้าย */}
                              <td className={`py-2 px-3 text-center text-sm font-medium ${statusColor}`}>
                                {statusText}
                              </td>

                              {/* Column 3: ใช้คำนวณ - กลางชิดขวา */}
                              <td className="py-2 px-3 text-center">
                                {isToday && (
                                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                    ใช้คำนวณ
                                  </span>
                                )}
                              </td>

                              {/* Column 4: ราคา - ชิดขวา */}
                              <td className={`py-2 px-3 text-right ${
                                isToday ? 'text-blue-600 text-lg' : 'text-gray-900'
                              }`}>
                                {item.price.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-2">ราคาน้ำมันดีเซล</p>
                    <p className="text-3xl font-bold text-orange-600">{currentOilPrice.toFixed(2)} บาท</p>
                    <p className="text-sm text-orange-500 mt-2">
                      ⚠️ ใช้ข้อมูลประมาณการ
                    </p>
                    <button
                      onClick={() => fetchOilPrice()}
                      className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                    >
                      🔄 ลองโหลดใหม่
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Price Calculator Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🧮 คำนวณราคาค่าขนส่ง</h2>
                <p className="text-blue-100 text-sm">ประเภทรถ: {selectedTruck.name}</p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    ประเภทงาน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none text-lg"
                  >
                    {availableJobs.map((job) => (
                      <option key={job} value={job}>{job}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    ระยะทาง <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="กรอกระยะทาง"
                      className="flex-1 border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none text-lg"
                    />
                    <span className="text-gray-600 font-medium">กม.</span>
                  </div>
                </div>

                {calculatedPrice !== null && priceDetails ? (
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 border-2 border-blue-200">
                    <div className="text-center">
                      <p className="text-gray-600 mb-2">ราคาค่าขนส่ง</p>
                      <p className="text-4xl font-bold text-blue-600">
                        ฿{calculatedPrice.toLocaleString()}
                      </p>
                      <div className="mt-4 text-sm text-gray-500 space-y-1">
                        <p>ช่วงราคาน้ำมัน: {priceDetails.oilRange}</p>
                        <p>ช่วงระยะทาง: {priceDetails.distRange}</p>
                        <p>ราคาน้ำมันที่ใช้: {currentOilPrice.toFixed(2)} บาท</p>
                      </div>
                    </div>
                  </div>
                ) : distance && !rateData ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                    ⚠️ กำลังโหลดข้อมูลราคา...
                  </div>
                ) : distance && rateData && !calculatedPrice ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                    ❌ ไม่พบราคาสำหรับระยะทาง {distance} กม.
                  </div>
                ) : null}
              </div>
            </div>

            <button
              onClick={() => setActiveTab('cbm')}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              📦 กลับไปคำนวณ CBM
            </button>
          </div>
        )}

        {/* Popups */}
        {showPopup && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPopup(false)}
          >
            <div className="relative max-w-2xl w-full max-h-[90vh] overflow-hidden rounded-xl bg-white p-2">
              <button
                onClick={() => setShowPopup(false)}
                className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-500 transition"
              >
                ✕
              </button>
              <div className="relative w-full h-[80vh]">
                <Image
                  src={popupImage}
                  alt="รายละเอียดรถ"
                  fill
                  style={{ objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

+++ src/app/page.tsx (修改后)
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// Types
interface OilPrice {
  date: string;
  price: number;
}

interface RateData {
  [key: string]: {
    oil_ranges: { min: number; max: number }[];
    data: {
      dist_min: number;
      dist_max: number;
      prices: number[];
    }[];
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

// Truck Data
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

const FALLBACK_OIL_PRICE = 50.54;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'cbm' | 'price'>('cbm');

  const [currentOilPrice, setCurrentOilPrice] = useState<number>(FALLBACK_OIL_PRICE);
  const [oilPriceHistory, setOilPriceHistory] = useState<OilPrice[]>([]);
  const [loadingOil, setLoadingOil] = useState(true);

  const [selectedJob, setSelectedJob] = useState<string>('4ล้อ_PPY');
  const [distance, setDistance] = useState<string>('');
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [priceDetails, setPriceDetails] = useState<{
    oilRange: string;
    distRange: string;
  } | null>(null);

  const [selectedTruck, setSelectedTruck] = useState(truckTypes[0]);
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
  ]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupImage, setPopupImage] = useState('');

  const [rateData, setRateData] = useState<RateData | null>(null);
  const [availableJobs, setAvailableJobs] = useState<string[]>([]);

  // Manual oil price editing
  const [showEditOilPrice, setShowEditOilPrice] = useState(false);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<{date: string; price: number} | null>(null);

  // Load rate data
  useEffect(() => {
    fetch('/transport_rates.json')
      .then((res) => res.json())
      .then((data) => {
        setRateData(data);
        const keys = Object.keys(data);
        setAvailableJobs(keys);
        if (keys.length > 0) {
          setSelectedJob(keys[0]);
        }
      })
      .catch((err) => console.error('Failed to load rate data:', err));
  }, []);

  // Fetch oil price
  const fetchOilPrice = useCallback(async () => {
    setLoadingOil(true);

    try {
      const res = await fetch('/api/oil-price');
      const data = await res.json();

      if (data.price !== undefined && data.price !== null) {
        setCurrentOilPrice(data.price);

        if (data.history && data.history.length > 0) {
          setOilPriceHistory(data.history);
        }
      }
    } catch (error) {
      console.error('Failed to fetch oil price:', error);
    } finally {
      setLoadingOil(false);
    }
  }, []);

  useEffect(() => {
    fetchOilPrice();
  }, [fetchOilPrice]);

  // Open edit modal for adding new price
  const openAddOilPrice = () => {
    setEditingEntry(null);
    setEditPrice('');
    setEditDate(new Date().toISOString().split('T')[0]);
    setShowEditOilPrice(true);
  };

  // Open edit modal for editing existing price
  const openEditOilPrice = (entry: {date: string; price: number}) => {
    setEditingEntry(entry);
    setEditPrice(entry.price.toString());
    // Convert Thai date format to YYYY-MM-DD for input
    const parts = entry.date.split('/');
    if (parts.length === 3) {
      setEditDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      setEditDate(new Date().toISOString().split('T')[0]);
    }
    setShowEditOilPrice(true);
  };

  // Delete oil price entry
  const deleteOilPrice = async (date: string) => {
    if (!confirm(`ต้องการลบราคาน้ำมันวันที่ ${date} ใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/oil-price?date=${encodeURIComponent(date)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchOilPrice();
      } else {
        alert('ไม่สามารถลบข้อมูลได้');
      }
    } catch (error) {
      console.error('Failed to delete oil price:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  // Save oil price (add or update)
  const saveOilPrice = async () => {
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('กรุณากรอกราคาที่ถูกต้อง');
      return;
    }

    if (!editDate) {
      alert('กรุณาเลือกวันที่');
      return;
    }

    // Convert YYYY-MM-DD to DD/MM/YYYY
    const dateParts = editDate.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    try {
      const res = await fetch('/api/oil-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: priceNum,
          date: formattedDate,
          manual: true,
        }),
      });

      if (res.ok) {
        setShowEditOilPrice(false);
        fetchOilPrice();
      } else {
        alert('ไม่สามารถบันทึกข้อมูลได้');
      }
    } catch (error) {
      console.error('Failed to save oil price:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  // Calculate price
  useEffect(() => {
    if (!rateData || !distance || !currentOilPrice) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    const jobData = rateData[selectedJob];
    if (!jobData) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    const dist = parseFloat(distance);
    if (isNaN(dist) || dist <= 0) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    let oilIndex = -1;
    for (let i = 0; i < jobData.oil_ranges.length; i++) {
      const range = jobData.oil_ranges[i];
      if (currentOilPrice >= range.min && currentOilPrice <= range.max) {
        oilIndex = i;
        break;
      }
    }

    if (oilIndex === -1) {
      oilIndex = jobData.oil_ranges.length - 1;
    }

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

      setCalculatedPrice(price);
      setPriceDetails({ oilRange, distRange });
    } else {
      setCalculatedPrice(null);
      setPriceDetails(null);
    }
  }, [rateData, selectedJob, distance, currentOilPrice]);

  const goToPriceCalculator = (truck: TruckType) => {
    setSelectedTruck(truck);
    setSelectedJob(truck.jobKey);
    setActiveTab('price');
  };

  const calculateCBM = (item: CargoItem) => {
    return ((item.width * item.length * item.height) / 1000000) * item.quantity;
  };

  const totalCBM = cargoItems.reduce((sum, item) => sum + calculateCBM(item), 0);
  const totalWeight = cargoItems.reduce((sum, item) => sum + item.weight * item.quantity, 0);

  const canFitInTruck = (item: CargoItem, truck: TruckType) => {
    const { width, length, height } = item;
    const { width: tw, length: tl, height: th } = truck.dimensions;

    const rotations = [
      [width, length, height],
      [width, height, length],
      [length, width, height],
      [length, height, width],
      [height, width, length],
      [height, length, width],
    ];

    return rotations.some(([w, l, h]) => w <= tw * 100 && l <= tl * 100 && h <= th * 100);
  };

  const getOversizedDimensions = (item: CargoItem, truck: TruckType) => {
    const issues: string[] = [];
    const { width, length, height } = item;
    const { width: tw, length: tl, height: th } = truck.dimensions;

    if (width > tw * 100 && width > tl * 100) issues.push(`กว้าง ${width} ซม.`);
    if (length > tl * 100 && length > tw * 100) issues.push(`ยาว ${length} ซม.`);
    if (height > th * 100) issues.push(`สูง ${height} ซม.`);

    return issues;
  };

  const checkAllItemsFit = () => {
    return cargoItems.every((item) => canFitInTruck(item, selectedTruck));
  };

  const getRecommendedTruck = () => {
    for (const truck of truckTypes) {
      const fits = cargoItems.every((item) => canFitInTruck(item, truck));
      const cbmOk = totalCBM <= truck.cbm * (truck.usableSpace / 100);
      const weightOk = totalWeight <= truck.maxWeight;

      if (fits && cbmOk && weightOk) {
        return truck;
      }
    }
    return null;
  };

  const recommendedTruck = cargoItems.length > 0 && totalCBM > 0 ? getRecommendedTruck() : null;
  const allItemsValid = cargoItems.every((item) => item.width > 0 && item.length > 0 && item.height > 0 && item.weight > 0);

  const addCargoItem = () => {
    setCargoItems([
      ...cargoItems,
      { id: Date.now().toString(), width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
    ]);
  };

  const removeCargoItem = (id: string) => {
    if (cargoItems.length > 1) {
      setCargoItems(cargoItems.filter((item) => item.id !== id));
    }
  };

  const updateCargoItem = (id: string, field: keyof CargoItem, value: number) => {
    setCargoItems(
      cargoItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const resetForm = () => {
    setCargoItems([
      { id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
    ]);
    setSelectedTruck(truckTypes[0]);
  };

  const openPopup = (image: string) => {
    setPopupImage(image);
    setShowPopup(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-4 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Image
            src="/images/3_20251016_054221_0002.png"
            alt="เผ่าปัญญา ทรานสปอร์ต"
            width={60}
            height={60}
            className="rounded-full"
          />
          <div>
            <h1 className="text-xl font-bold">หจก.เผ่าปัญญา ทรานสปอร์ต</h1>
            <p className="text-blue-200 text-sm">เครื่องมือช่วยคำนวณการขนส่ง</p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-2 bg-white rounded-lg shadow p-1">
          <button
            onClick={() => setActiveTab('cbm')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'cbm'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📦 คำนวณ CBM
          </button>
          <button
            onClick={() => setActiveTab('price')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'price'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            💰 คำนวณราคา
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* CBM Calculator Tab */}
        {activeTab === 'cbm' && (
          <div className="space-y-6">
            {/* Truck Selection */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🚛 เลือกประเภทรถ</h2>
                <p className="text-blue-100 text-sm">เลือกรถแล้วกด &quot;คำนวณราคา&quot; เพื่อไปหน้าคำนวณราคาอัตโนมัติ</p>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {truckTypes.map((truck) => (
                  <div
                    key={truck.id}
                    className={`rounded-xl border-2 transition-all ${
                      selectedTruck.id === truck.id
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div
                      className="relative h-48 overflow-hidden rounded-t-xl cursor-pointer"
                      onClick={() => setSelectedTruck(truck)}
                    >
                      <Image
                        src={truck.image}
                        alt={truck.name}
                        fill
                        className="object-cover object-top"
                        style={{ objectPosition: 'top' }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPopup(truck.image);
                        }}
                        className="absolute bottom-2 left-2 bg-white text-blue-600 text-xs px-2 py-1 rounded shadow hover:bg-blue-50"
                      >
                        กดเพื่อดูข้อมูลเพิ่มเติม
                      </button>
                      {selectedTruck.id === truck.id && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-gray-800">{truck.name}</h3>
                      <p className="text-sm text-gray-600">CBM: {truck.cbm} | น้ำหนัก: {truck.maxWeight.toLocaleString()} kg</p>

                      <button
                        onClick={() => goToPriceCalculator(truck)}
                        className="mt-2 w-full py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition text-sm"
                      >
                        💰 คำนวณราคา
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cargo Items */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">📦 รายการสินค้า</h2>
                  <p className="text-yellow-100 text-xs">สามารถเลือก รายการสินค้าได้มากกว่า 1 รายการ โดยกดปุ่ม &quot;+ เพิ่มรายการ&quot; จะมีรายการเพิ่มด้านล่างอัตโนมัติ </p>
                </div>
                <button
                  onClick={addCargoItem}
                  className="bg-white text-orange-600 px-3 py-1 rounded-lg font-medium hover:bg-orange-50"
                >
                  + เพิ่มรายการ
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* แต่ละรายการอยู่คนละบรรทัด แยกกันชัดเจน */}
                {cargoItems.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 block w-full">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800 bg-blue-100 px-3 py-1 rounded">
                        รายการที่ {index + 1}
                      </span>
                      {cargoItems.length > 1 && (
                        <button
                          onClick={() => removeCargoItem(item.id)}
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          ✕ ลบรายการนี้
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-medium">กว้าง (ซม.) *</label>
                        <input
                          type="number"
                          value={item.width || ''}
                          onChange={(e) => updateCargoItem(item.id, 'width', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">ยาว (ซม.) *</label>
                        <input
                          type="number"
                          value={item.length || ''}
                          onChange={(e) => updateCargoItem(item.id, 'length', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">สูง (ซม.) *</label>
                        <input
                          type="number"
                          value={item.height || ''}
                          onChange={(e) => updateCargoItem(item.id, 'height', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">จำนวน</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCargoItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium">น้ำหนัก (kg) *</label>
                        <input
                          type="number"
                          value={item.weight || ''}
                          onChange={(e) => updateCargoItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {item.width > 0 && item.length > 0 && item.height > 0 && (
                      <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium">
                          📦 CBM: {calculateCBM(item).toFixed(4)} m³
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            {totalCBM > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-4">
                  <h2 className="text-lg font-bold">📊 ผลการตรวจสอบ</h2>
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

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>การใช้พื้นที่</span>
                        <span>{((totalCBM / (selectedTruck.cbm * selectedTruck.usableSpace / 100)) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            totalCBM > selectedTruck.cbm * selectedTruck.usableSpace / 100
                              ? 'bg-red-500'
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              (totalCBM / (selectedTruck.cbm * selectedTruck.usableSpace / 100)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>การใช้น้ำหนัก</span>
                        <span>{((totalWeight / selectedTruck.maxWeight) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            totalWeight > selectedTruck.maxWeight ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min((totalWeight / selectedTruck.maxWeight) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {!allItemsValid && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800">
                      ⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง
                    </div>
                  )}

                  {allItemsValid && !checkAllItemsFit() && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-800 font-medium">❌ สินค้ามีขนาดใหญ่เกินไป</p>
                      <ul className="text-sm text-red-600 mt-1">
                        {cargoItems.map((item, idx) => {
                          const issues = getOversizedDimensions(item, selectedTruck);
                          return issues.length > 0 ? (
                            <li key={item.id}>รายการ {idx + 1}: {issues.join(', ')}</li>
                          ) : null;
                        })}
                      </ul>
                    </div>
                  )}

                  {allItemsValid && checkAllItemsFit() && totalCBM <= selectedTruck.cbm * selectedTruck.usableSpace / 100 && totalWeight <= selectedTruck.maxWeight && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <p className="text-green-800 font-bold text-lg">✅ ใส่รถ {selectedTruck.name} ได้!</p>
                    </div>
                  )}

                  {recommendedTruck && recommendedTruck.id !== selectedTruck.id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-800 font-medium">
                        💡 แนะนำ: {recommendedTruck.name}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => goToPriceCalculator(selectedTruck)}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-green-700 transition"
                  >
                    💰 ไปคำนวณราคาค่าขนส่ง
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={resetForm}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300"
            >
               รีเซ็ตข้อมูล
            </button>
          </div>
        )}

        {/* Price Calculator Tab */}
        {activeTab === 'price' && (
          <div className="space-y-6">
            {/* Oil Price Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  ⛽ ราคาน้ำมันดีเซล (ดีเซล)
                </h2>
                <p className="text-green-100 text-sm">อ้างอิง: ปตท.</p>
              </div>

              <div className="p-4">
                {loadingOil ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-2">กำลังโหลดราคาน้ำมัน...</p>
                  </div>
                ) : oilPriceHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium text-gray-700">ประวัติราคาน้ำมัน</h3>
                      <button
                        onClick={openAddOilPrice}
                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-1"
                      >
                        ➕ เพิ่มราคาเอง
                      </button>
                    </div>
                    <table className="w-full table-fixed">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-2 px-3 text-gray-600 font-medium w-1/4">วันที่</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-1/5">สถานะ</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-1/5">ใช้คำนวณ</th>
                          <th className="text-right py-2 px-3 text-gray-600 font-medium w-1/5">ราคา (บาท)</th>
                          <th className="text-center py-2 px-3 text-gray-600 font-medium w-1/5">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oilPriceHistory.map((item, index) => {
                          let statusText = '';
                          let statusColor = '';

                          if (index < oilPriceHistory.length - 1) {
                            const prevPrice = oilPriceHistory[index + 1].price;
                            const diff = item.price - prevPrice;

                            if (diff > 0) {
                              statusText = `▲ เพิ่มขึ้น`;
                              statusColor = 'text-red-500';
                            } else if (diff < 0) {
                              statusText = `▼ ลดลง`;
                              statusColor = 'text-green-500';
                            }
                          }

                          const isToday = index === 0;

                          return (
                            <tr
                              key={item.date}
                              className={`border-b ${
                                isToday ? 'bg-blue-50 font-bold' : ''
                              }`}
                            >
                              {/* Column 1: วันที่ - ชิดซ้าย */}
                              <td className="py-2 px-3 text-left text-gray-700">
                                {item.date}
                              </td>

                              {/* Column 2: สถานะปรับราคา - กลางชิดซ้าย */}
                              <td className={`py-2 px-3 text-center text-sm font-medium ${statusColor}`}>
                                {statusText}
                              </td>

                              {/* Column 3: ใช้คำนวณ - กลางชิดขวา */}
                              <td className="py-2 px-3 text-center">
                                {isToday && (
                                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                    ใช้คำนวณ
                                  </span>
                                )}
                              </td>

                              {/* Column 4: ราคา - ชิดขวา */}
                              <td className={`py-2 px-3 text-right ${
                                isToday ? 'text-blue-600 text-lg' : 'text-gray-900'
                              }`}>
                                {item.price.toFixed(2)}
                              </td>

                              {/* Column 5: จัดการ buttons */}
                              <td className="py-2 px-3 text-center">
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={() => openEditOilPrice(item)}
                                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                    title="แก้ไข"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => deleteOilPrice(item.date)}
                                    className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                                    title="ลบ"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-2">ราคาน้ำมันดีเซล</p>
                    <p className="text-3xl font-bold text-orange-600">{currentOilPrice.toFixed(2)} บาท</p>
                    <p className="text-sm text-orange-500 mt-2">
                      ⚠️ ใช้ข้อมูลประมาณการ
                    </p>
                    <button
                      onClick={() => fetchOilPrice()}
                      className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                    >
                      🔄 ลองโหลดใหม่
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Price Calculator Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🧮 คำนวณราคาค่าขนส่ง</h2>
                <p className="text-blue-100 text-sm">ประเภทรถ: {selectedTruck.name}</p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    ประเภทงาน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none text-lg"
                  >
                    {availableJobs.map((job) => (
                      <option key={job} value={job}>{job}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    ระยะทาง <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="กรอกระยะทาง"
                      className="flex-1 border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none text-lg"
                    />
                    <span className="text-gray-600 font-medium">กม.</span>
                  </div>
                </div>

                {calculatedPrice !== null && priceDetails ? (
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 border-2 border-blue-200">
                    <div className="text-center">
                      <p className="text-gray-600 mb-2">ราคาค่าขนส่ง</p>
                      <p className="text-4xl font-bold text-blue-600">
                        ฿{calculatedPrice.toLocaleString()}
                      </p>
                      <div className="mt-4 text-sm text-gray-500 space-y-1">
                        <p>ช่วงราคาน้ำมัน: {priceDetails.oilRange}</p>
                        <p>ช่วงระยะทาง: {priceDetails.distRange}</p>
                        <p>ราคาน้ำมันที่ใช้: {currentOilPrice.toFixed(2)} บาท</p>
                      </div>
                    </div>
                  </div>
                ) : distance && !rateData ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                    ⚠️ กำลังโหลดข้อมูลราคา...
                  </div>
                ) : distance && rateData && !calculatedPrice ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                    ❌ ไม่พบราคาสำหรับระยะทาง {distance} กม.
                  </div>
                ) : null}
              </div>
            </div>

            <button
              onClick={() => setActiveTab('cbm')}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              📦 กลับไปคำนวณ CBM
            </button>
          </div>
        )}

        {/* Popups */}
        {showPopup && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPopup(false)}
          >
            <div className="relative max-w-2xl w-full max-h-[90vh] overflow-hidden rounded-xl bg-white p-2">
              <button
                onClick={() => setShowPopup(false)}
                className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-500 transition"
              >
                ✕
              </button>
              <div className="relative w-full h-[80vh]">
                <Image
                  src={popupImage}
                  alt="รายละเอียดรถ"
                  fill
                  style={{ objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Edit Oil Price Modal */}
        {showEditOilPrice && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditOilPrice(false)}
          >
            <div
              className="relative max-w-md w-full bg-white rounded-xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingEntry ? '✏️ แก้ไขราคาน้ำมัน' : '➕ เพิ่มราคาน้ำมัน'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    วันที่ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    ราคา (บาท) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="เช่น 50.54"
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setShowEditOilPrice(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={saveOilPrice}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    💾 บันทึก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
