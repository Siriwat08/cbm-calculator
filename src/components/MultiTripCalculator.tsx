'use client';

import { useState, useMemo } from 'react';
import { calculateMultiTrip } from '@/lib/multi-trip-calculator';
import type { CargoItem, RateData } from '@/lib/types';

interface MultiTripCalculatorProps {
  cargoItems: CargoItem[];
  distance: number;
  oilPrice: number;
  rateData: RateData | null;
  includeLabor: boolean;
}

const MAX_TRIPS_DISPLAY = 10;

export default function MultiTripCalculator({
  cargoItems,
  distance,
  oilPrice,
  rateData,
  includeLabor,
}: MultiTripCalculatorProps) {
  const [expandedTruck, setExpandedTruck] = useState<string | null>(null);

  const results = useMemo(() => {
    // Only calculate if we have valid items
    const validItems = cargoItems.filter(
      (item) => item.width > 0 && item.length > 0 && item.height > 0
    );
    if (validItems.length === 0) return [];
    return calculateMultiTrip(cargoItems, distance, oilPrice, rateData, includeLabor);
  }, [cargoItems, distance, oilPrice, rateData, includeLabor]);

  const totalCBM = cargoItems.reduce(
    (sum, item) => sum + ((item.width * item.length * item.height) / 1000000) * item.quantity,
    0
  );
  const totalWeight = cargoItems.reduce(
    (sum, item) => sum + item.weight * item.quantity,
    0
  );
  const totalItems = cargoItems.reduce((sum, item) => sum + item.quantity, 0);

  // If distance is not set, show prompt
  if (distance <= 0 || isNaN(distance)) {
    return (
      <div className="space-y-6">
        {/* Summary Card */}
        <section className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-6 py-4">
            <h2 className="text-lg font-bold">🚚 คำนวณหลายเที่ยว</h2>
            <p className="text-violet-100 text-sm">เปรียบเทียบราคาค่าขนส่งสำหรับแต่ละประเภทรถ</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-violet-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">รายการสินค้า</p>
                <p className="text-xl font-bold text-violet-600">{cargoItems.length}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">CBM รวม</p>
                <p className="text-xl font-bold text-blue-600">{totalCBM.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">น้ำหนักรวม</p>
                <p className="text-xl font-bold text-orange-600">{totalWeight.toLocaleString()} kg</p>
              </div>
            </div>
          </div>
        </section>

        {/* Distance prompt */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-800 font-bold text-lg">⚠️ กรุณาระบุระยะทาง</p>
          <p className="text-amber-600 text-sm mt-2">
            ไปที่แท็บ &quot;💰 คำนวณราคา&quot; เพื่อค้นหาระยะทาง หรือใส่ระยะทางด้วยตนเอง
          </p>
        </div>
      </div>
    );
  }

  // If no valid items, show prompt
  const validItems = cargoItems.filter(
    (item) => item.width > 0 && item.length > 0 && item.height > 0
  );
  if (validItems.length === 0) {
    return (
      <div className="space-y-6">
        <section className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-6 py-4">
            <h2 className="text-lg font-bold">🚚 คำนวณหลายเที่ยว</h2>
            <p className="text-violet-100 text-sm">เปรียบเทียบราคาค่าขนส่งสำหรับแต่ละประเภทรถ</p>
          </div>
          <div className="p-4">
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <p className="text-gray-500">กรุณาเพิ่มรายการสินค้าที่แท็บ &quot;📦 คำนวณ CBM&quot; ก่อน</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <section className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-6 py-4">
          <h2 className="text-lg font-bold">🚚 คำนวณหลายเที่ยว</h2>
          <p className="text-violet-100 text-sm">เปรียบเทียบราคาค่าขนส่งสำหรับแต่ละประเภทรถ</p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">รายการสินค้า</p>
              <p className="text-xl font-bold text-violet-600">{totalItems} ชิ้น</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">CBM รวม</p>
              <p className="text-xl font-bold text-blue-600">{totalCBM.toFixed(2)} m³</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">น้ำหนักรวม</p>
              <p className="text-xl font-bold text-orange-600">{totalWeight.toLocaleString()} kg</p>
            </div>
          </div>
          <div className="mt-3 bg-gray-50 rounded-lg p-2 flex justify-between text-xs text-gray-500">
            <span>ระยะทาง: {distance.toFixed(1)} กม.</span>
            <span>ราคาน้ำมัน: {oilPrice.toFixed(2)} บาท/ลิตร</span>
            {includeLabor && <span>รวมค่าแรง: 500 บาท/เที่ยว</span>}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4">
          <h2 className="text-lg font-bold">📊 เปรียบเทียบราคาทุกประเภทรถ</h2>
          <p className="text-slate-300 text-sm">⭐ แนะนำ = ราคารวมถูกที่สุด | คลิกที่แถวเพื่อดูรายละเอียด</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 text-gray-600 font-medium text-sm">ประเภทรถ</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium text-sm">จำนวนคัน</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium text-sm">CBM รวม</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium text-sm">น้ำหนักรวม</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium text-sm">ราคา/คัน</th>
                <th className="text-right py-3 px-4 text-gray-600 font-medium text-sm">ราคารวม</th>
                <th className="text-center py-3 px-4 text-gray-600 font-medium text-sm">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const isExpanded = expandedTruck === result.truckType.id;
                const pricePerTrip =
                  result.trips.length > 0 ? result.trips[0].pricePerTrip : null;

                // Determine row styling
                let rowClass = 'border-b cursor-pointer transition-colors ';
                if (isExpanded) {
                  rowClass += 'bg-violet-50';
                } else if (!result.canFitDimensionally) {
                  rowClass += 'bg-red-50/50 hover:bg-red-50';
                } else if (result.bestValue) {
                  rowClass += 'bg-emerald-50 hover:bg-emerald-100';
                } else {
                  rowClass += 'hover:bg-gray-50';
                }

                return (
                  <tr
                    key={result.truckType.id}
                    className={rowClass}
                    onClick={() =>
                      setExpandedTruck(
                        isExpanded ? null : result.truckType.id
                      )
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">
                        {result.truckType.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        CBM: {result.truckType.cbm} | น้ำหนัก: {result.truckType.maxWeight.toLocaleString()} kg
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!result.canFitDimensionally ? (
                        <span className="text-red-500 font-bold">—</span>
                      ) : result.feasible ? (
                        <div>
                          <span className="font-bold text-gray-800">
                            {result.totalTrips} คัน
                          </span>
                          {result.oneRound && (
                            <span className="ml-1 bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                              1 รอบ
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-red-600 font-bold">
                          {result.totalTrips > 0 ? `${result.totalTrips}+ คัน` : 'ไม่พอ'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-700">
                      {result.canFitDimensionally ? `${result.totalCBM.toFixed(2)} m³` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-700">
                      {result.canFitDimensionally ? `${result.totalWeight.toLocaleString()} kg` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-700">
                      {pricePerTrip !== null && result.canFitDimensionally
                        ? `${pricePerTrip.toLocaleString()} ฿`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!result.canFitDimensionally ? (
                        <span className="text-red-500">—</span>
                      ) : result.feasible ? (
                        <span className="font-bold text-gray-800">
                          {result.totalPrice.toLocaleString()} ฿
                        </span>
                      ) : (
                        <span className="text-red-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {result.bestValue && result.feasible && result.canFitDimensionally && (
                        <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                          ⭐ แนะนำ
                        </span>
                      )}
                      {!result.bestValue && result.feasible && result.canFitDimensionally && result.oneRound && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                          1 รอบ
                        </span>
                      )}
                      {!result.canFitDimensionally && (
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium">
                          ไม่สามารถรองรับ
                        </span>
                      )}
                      {result.canFitDimensionally && !result.feasible && (
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium">
                          เกิน {MAX_TRIPS_DISPLAY} คัน
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dimensional issue warning */}
        {results.some((r) => !r.canFitDimensionally) && (
          <div className="border-t p-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 font-medium text-sm">
                ⚠️ รถที่ไม่สามารถรองรับสินค้าได้:
              </p>
              <ul className="text-sm text-red-600 mt-1 space-y-1">
                {results
                  .filter((r) => !r.canFitDimensionally)
                  .map((r) => (
                    <li key={r.truckType.id}>
                      • {r.truckType.name} — {r.dimensionalIssue || 'สินค้ามีขนาดใหญ่เกินรถ'}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        {/* Expanded Trip Details */}
        {expandedTruck && (() => {
          const result = results.find((r) => r.truckType.id === expandedTruck);
          if (!result || !result.canFitDimensionally) return null;

          return (
            <div className="border-t">
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-6 py-3">
                <h3 className="font-bold text-violet-800">
                  รายละเอียด: {result.truckType.name}
                  {result.bestValue && (
                    <span className="ml-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
                      ราคาดีที่สุด
                    </span>
                  )}
                </h3>
                <p className="text-xs text-violet-600">
                  ขนาด: {result.truckType.dimensions.width}×{result.truckType.dimensions.length}×{result.truckType.dimensions.height} ม. |
                  CBM: {result.truckType.cbm} m³ |
                  น้ำหนักสูงสุด: {result.truckType.maxWeight.toLocaleString()} kg |
                  พื้นที่ใช้ได้: {result.truckType.usableSpace}%
                </p>
              </div>

              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {result.trips.map((trip) => (
                  <div
                    key={trip.tripIndex}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-gray-800">
                        คันที่ {trip.tripIndex}
                      </h4>
                      <span className="text-sm font-bold text-violet-600">
                        {trip.pricePerTrip !== null
                          ? `${trip.pricePerTrip.toLocaleString()} บาท`
                          : 'ไม่สามารถคำนวณราคาได้'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="bg-white rounded-lg p-2 text-center border">
                        <p className="text-[10px] text-gray-500">สินค้า</p>
                        <p className="text-sm font-bold text-gray-800">
                          {trip.items.reduce((s, i) => s + i.quantity, 0)} ชิ้น
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center border">
                        <p className="text-[10px] text-gray-500">CBM</p>
                        <p className="text-sm font-bold text-blue-600">
                          {trip.tripCBM.toFixed(2)} m³
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center border">
                        <p className="text-[10px] text-gray-500">น้ำหนัก</p>
                        <p className="text-sm font-bold text-orange-600">
                          {trip.tripWeight.toLocaleString()} kg
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center border">
                        <p className="text-[10px] text-gray-500">ใช้พื้นที่</p>
                        <p className={`text-sm font-bold ${
                          trip.binPackingResult.utilizationPercent > 90
                            ? 'text-red-600'
                            : trip.binPackingResult.utilizationPercent > 70
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}>
                          {trip.binPackingResult.utilizationPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>การใช้พื้นที่</span>
                        <span>{trip.binPackingResult.utilizationPercent.toFixed(1)}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            trip.binPackingResult.utilizationPercent > 90
                              ? 'bg-red-500'
                              : trip.binPackingResult.utilizationPercent > 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              trip.binPackingResult.utilizationPercent,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Weight utilization */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>การใช้น้ำหนัก</span>
                        <span>
                          {(
                            (trip.tripWeight / result.truckType.maxWeight) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            trip.tripWeight > result.truckType.maxWeight
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              (trip.tripWeight / result.truckType.maxWeight) *
                                100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Weight limited warning for this trip */}
                    {trip.binPackingResult.weightLimited && (
                      <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <p className="text-xs text-amber-700 font-medium">
                          ⚠️ คันนี้ถูกจำกัดด้วยน้ำหนัก: วางได้ {trip.binPackingResult.items.length} ชิ้น ({trip.binPackingResult.fittedWeight?.toLocaleString()} kg / {result.truckType.maxWeight.toLocaleString()} kg)
                          — ถอดออกเพราะน้ำหนักเกิน {trip.binPackingResult.weightLimitRemovedCount} ชิ้น
                        </p>
                      </div>
                    )}

                    {/* Items list for this trip */}
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        รายการสินค้าในรถคันนี้:
                      </p>
                      <div className="space-y-1">
                        {trip.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center text-xs"
                          >
                            <span className="text-gray-700">
                              {item.width}×{item.length}×{item.height} ซม.
                              {item.quantity > 1 && (
                                <span className="text-gray-400 ml-1">
                                  ×{item.quantity}
                                </span>
                              )}
                            </span>
                            <span className="text-gray-500">
                              {(
                                ((item.width *
                                  item.length *
                                  item.height) /
                                  1000000) *
                                item.quantity
                              ).toFixed(3)}{' '}
                              m³ | {(item.weight * item.quantity).toLocaleString()} kg
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Unfitted items for this trip */}
                    {trip.binPackingResult.unfittedItems.length > 0 && (
                      <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                        <p className="text-xs text-red-700 font-medium">
                          วางไม่ได้ในรถคันนี้: {trip.binPackingResult.unfittedItems.length} ชิ้น
                          (จะไปคันถัดไป)
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Total summary for this truck */}
                <div className={`rounded-lg p-4 border-2 ${
                  result.bestValue
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800">
                        รวม {result.totalTrips} คัน — {result.truckType.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        CBM: {result.totalCBM.toFixed(2)} m³ | น้ำหนัก: {result.totalWeight.toLocaleString()} kg
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-800">
                        {result.totalPrice.toLocaleString()} ฿
                      </p>
                      {includeLabor && result.trips.length > 0 && result.trips[0].pricePerTrip !== null && (
                        <p className="text-xs text-gray-500">
                          รวมค่าแรงแล้ว
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
