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
  },
  {
    id: 'jumbo',
    name: 'รถ 4 ล้อจัมโบ้',
    image: '/images/Screenshot_20260320_125652_OneDrive.jpg',
    cbm: 11,
    maxWeight: 3000,
    dimensions: { width: 1.80, length: 3.20, height: 2.10 },
    usableSpace: 100,
  },
  {
    id: '6wheel',
    name: 'รถ 6 ล้อ',
    image: '/images/Screenshot_20260320_125638_OneDrive.jpg',
    cbm: 32,
    maxWeight: 6000,
    dimensions: { width: 2.40, length: 6.60, height: 2.35 },
    usableSpace: 90,
  },
];

export default function Home() {
  // Tab State
  const [activeTab, setActiveTab] = useState<'price' | 'cbm'>('price');
  
  // Oil Price State
  const [currentOilPrice, setCurrentOilPrice] = useState<number | null>(null);
  const [oilPriceHistory, setOilPriceHistory] = useState<OilPrice[]>([]);
  const [loadingOil, setLoadingOil] = useState(true);
  
  // Price Calculator State
  const [selectedJob, setSelectedJob] = useState('4ล้อ_PPY');
  const [distance, setDistance] = useState('');
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [priceDetails, setPriceDetails] = useState<{
    oilRange: string;
    distRange: string;
  } | null>(null);
  
  // CBM Calculator State
  const [selectedTruck, setSelectedTruck] = useState(truckTypes[0]);
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { id: '1', width: 0, length: 0, height: 0, quantity: 1, weight: 0 },
  ]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupImage, setPopupImage] = useState('');
  
  // Rate Data
  const [rateData, setRateData] = useState<RateData | null>(null);

  // Load rate data
  useEffect(() => {
    fetch('/transport_rates.json')
      .then((res) => res.json())
      .then((data) => setRateData(data))
      .catch(() => console.error('Failed to load rate data'));
  }, []);

  // Fetch oil price
  const fetchOilPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/oil-price');
      const data = await res.json();
      
      if (data.price) {
        setCurrentOilPrice(data.price);
        
        // Save to history (localStorage)
        const savedHistory = localStorage.getItem('oilPriceHistory');
        let history: OilPrice[] = savedHistory ? JSON.parse(savedHistory) : [];
        
        // Check if this date already exists
        const exists = history.some((h) => h.date === data.date);
        if (!exists) {
          history.unshift({ date: data.date, price: data.price });
          // Keep only last 5
          history = history.slice(0, 5);
          localStorage.setItem('oilPriceHistory', JSON.stringify(history));
        }
        
        setOilPriceHistory(history);
      }
    } catch {
      console.error('Failed to fetch oil price');
    } finally {
      setLoadingOil(false);
    }
  }, []);

  useEffect(() => {
    fetchOilPrice();
    
    // Load history from localStorage
    const savedHistory = localStorage.getItem('oilPriceHistory');
    if (savedHistory) {
      setOilPriceHistory(JSON.parse(savedHistory));
    }
  }, [fetchOilPrice]);

  // Calculate price
  useEffect(() => {
    if (!rateData || !distance || !currentOilPrice) {
      setCalculatedPrice(null);
      setPriceDetails(null);
      return;
    }

    const jobData = rateData[selectedJob];
    if (!jobData) return;

    const dist = parseFloat(distance);
    
    // Find oil price range
    let oilIndex = -1;
    for (let i = 0; i < jobData.oil_ranges.length; i++) {
      const range = jobData.oil_ranges[i];
      if (currentOilPrice >= range.min && currentOilPrice <= range.max) {
        oilIndex = i;
        break;
      }
    }

    if (oilIndex === -1) {
      // Use last range if price is higher
      oilIndex = jobData.oil_ranges.length - 1;
    }

    // Find distance range
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
      // Check if distance is below minimum
      if (dist < jobData.data[0].dist_min) {
        distIndex = 0;
        distRange = `0 - ${jobData.data[0].dist_max} กม.`;
      } else {
        // Use last range if distance is higher
        const lastRow = jobData.data[jobData.data.length - 1];
        distIndex = jobData.data.length - 1;
        distRange = `${lastRow.dist_min} - ${lastRow.dist_max}+ กม.`;
      }
    }

    const price = jobData.data[distIndex].prices[oilIndex];
    const oilRange = `${jobData.oil_ranges[oilIndex].min} - ${jobData.oil_ranges[oilIndex].max} บาท`;

    setCalculatedPrice(price);
    setPriceDetails({ oilRange, distRange });
  }, [rateData, selectedJob, distance, currentOilPrice]);

  // CBM Calculations
  const calculateCBM = (item: CargoItem) => {
    return ((item.width * item.length * item.height) / 1000000) * item.quantity;
  };

  const totalCBM = cargoItems.reduce((sum, item) => sum + calculateCBM(item), 0);
  const totalWeight = cargoItems.reduce((sum, item) => sum + item.weight * item.quantity, 0);

  const canFitInTruck = (item: CargoItem, truck: TruckType) => {
    const { width, length, height } = item;
    const { width: tw, length: tl, height: th } = truck.dimensions;
    
    // Try all rotations
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

    if (width > tw * 100 && length > tw * 100 && height > tw * 100) {
      issues.push(`ทุกด้านเกิน ${tw * 100} ซม.`);
    } else {
      if (width > tw * 100 && width > tl * 100) issues.push(`กว้าง ${width} ซม.`);
      if (length > tl * 100 && length > tw * 100) issues.push(`ยาว ${length} ซม.`);
      if (height > th * 100) issues.push(`สูง ${height} ซม.`);
    }

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
            onClick={() => setActiveTab('price')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'price'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            💰 คำนวณราคา
          </button>
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
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Price Calculator Tab */}
        {activeTab === 'price' && (
          <div className="space-y-6">
            {/* Oil Price Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  ⛽ ราคาน้ำมันดีเซล (ไฮดีเซล S)
                </h2>
                <p className="text-green-100 text-sm">อ้างอิง: ปตท.</p>
              </div>
              
              <div className="p-4">
                {loadingOil ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-2">กำลังโหลดราคาน้ำมัน...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-2 px-3 text-gray-600 font-medium">วันที่ปรับราคา</th>
                          <th className="text-right py-2 px-3 text-gray-600 font-medium">ราคา (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oilPriceHistory.map((item, index) => (
                          <tr
                            key={item.date}
                            className={`border-b ${
                              index === 0 ? 'bg-blue-50 font-bold' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-gray-700">
                              {item.date}
                              {index === 0 && (
                                <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                  ใช้คำนวณ
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900">
                              {item.price.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {oilPriceHistory.length === 0 && currentOilPrice && (
                          <tr className="bg-blue-50 font-bold">
                            <td className="py-2 px-3 text-gray-700">
                              วันนี้
                              <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                ใช้คำนวณ
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900">
                              {currentOilPrice.toFixed(2)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Price Calculator Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🧮 คำนวณราคาค่าขนส่ง</h2>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Job Selection */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    ประเภทงาน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none text-lg"
                  >
                    <option value="4ล้อ_PPY">4 ล้อ PPY</option>
                    <option value="จัมโบ้_PPY">4 ล้อ จัมโบ้ PPY</option>
                    <option value="6ล้อ_PPY">6 ล้อ PPY</option>
                  </select>
                </div>

                {/* Distance Input */}
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

                {/* Result */}
                {calculatedPrice !== null && priceDetails && (
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 border-2 border-blue-200">
                    <div className="text-center">
                      <p className="text-gray-600 mb-2">ราคาค่าขนส่ง</p>
                      <p className="text-4xl font-bold text-blue-600">
                        ฿{calculatedPrice.toLocaleString()}
                      </p>
                      <div className="mt-4 text-sm text-gray-500 space-y-1">
                        <p>ช่วงราคาน้ำมัน: {priceDetails.oilRange}</p>
                        <p>ช่วงระยะทาง: {priceDetails.distRange}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CBM Calculator Tab */}
        {activeTab === 'cbm' && (
          <div className="space-y-6">
            {/* Truck Selection */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <h2 className="text-lg font-bold">🚛 เลือกประเภทรถ</h2>
              </div>
              
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {truckTypes.map((truck) => (
                  <div
                    key={truck.id}
                    onClick={() => setSelectedTruck(truck)}
                    className={`cursor-pointer rounded-xl border-2 transition-all ${
                      selectedTruck.id === truck.id
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="relative h-48 overflow-hidden rounded-t-xl">
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
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-gray-800">{truck.name}</h3>
                      <p className="text-sm text-gray-600">CBM: {truck.cbm} | น้ำหนัก: {truck.maxWeight.toLocaleString()} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cargo Items */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-bold">📦 รายการสินค้า</h2>
                <button
                  onClick={addCargoItem}
                  className="bg-white text-orange-600 px-3 py-1 rounded-lg font-medium hover:bg-orange-50"
                >
                  + เพิ่มรายการ
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {cargoItems.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-gray-700">รายการ {index + 1}</span>
                      {cargoItems.length > 1 && (
                        <button
                          onClick={() => removeCargoItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕ ลบ
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">กว้าง (ซม.) *</label>
                        <input
                          type="number"
                          value={item.width || ''}
                          onChange={(e) => updateCargoItem(item.id, 'width', parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">ยาว (ซม.) *</label>
                        <input
                          type="number"
                          value={item.length || ''}
                          onChange={(e) => updateCargoItem(item.id, 'length', parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">สูง (ซม.) *</label>
                        <input
                          type="number"
                          value={item.height || ''}
                          onChange={(e) => updateCargoItem(item.id, 'height', parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">จำนวน</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCargoItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full border rounded px-2 py-1"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">น้ำหนัก (kg) *</label>
                        <input
                          type="number"
                          value={item.weight || ''}
                          onChange={(e) => updateCargoItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </div>
                    </div>
                    
                    {item.width > 0 && item.length > 0 && item.height > 0 && (
                      <p className="text-sm text-blue-600 mt-2">
                        CBM: {calculateCBM(item).toFixed(4)} m³
                      </p>
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
                  {/* Summary */}
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

                  {/* Capacity Bars */}
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

                  {/* Validation Messages */}
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
                </div>
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={resetForm}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300"
            >
              🔄 รีเซ็ตข้อมูล
            </button>
          </div>
        )}
      </main>

      {/* Image Popup */}
      {showPopup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPopup(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowPopup(false)}
              className="absolute -top-10 right-0 text-white text-3xl hover:text-gray-300"
            >
              ✕
            </button>
            <Image
              src={popupImage}
              alt="Truck Image"
              width={800}
              height={600}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 px-4 mt-8">
        <div className="max-w-4xl mx-auto text-center">
          <Image
            src="/images/3_20251016_054221_0002.png"
            alt="เผ่าปัญญา ทรานสปอร์ต"
            width={50}
            height={50}
            className="mx-auto rounded-full mb-2"
          />
          <p className="font-bold">หจก.เผ่าปัญญา ทรานสปอร์ต</p>
          <p className="text-gray-400 text-sm mt-1">สงวนลิขสิทธิ์ © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
