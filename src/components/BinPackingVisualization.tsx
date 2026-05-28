'use client';

import { useState } from 'react';
import type { BinPackingResult, TruckType, CargoItem } from '@/lib/types';

interface BinPackingVisualizationProps {
  result: BinPackingResult;
  truck: TruckType;
  cargoItems: CargoItem[];
}

// Color palette for different cargo items
const CARGO_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.7)', border: 'rgb(37, 99, 235)', label: 'สินค้า 1' },   // blue
  { bg: 'rgba(16, 185, 129, 0.7)', border: 'rgb(5, 150, 105)', label: 'สินค้า 2' },   // emerald
  { bg: 'rgba(245, 158, 11, 0.7)', border: 'rgb(217, 119, 6)', label: 'สินค้า 3' },    // amber
  { bg: 'rgba(239, 68, 68, 0.7)', border: 'rgb(220, 38, 38)', label: 'สินค้า 4' },    // red
  { bg: 'rgba(139, 92, 246, 0.7)', border: 'rgb(109, 40, 217)', label: 'สินค้า 5' },   // violet
  { bg: 'rgba(236, 72, 153, 0.7)', border: 'rgb(190, 24, 93)', label: 'สินค้า 6' },   // pink
  { bg: 'rgba(20, 184, 166, 0.7)', border: 'rgb(13, 148, 136)', label: 'สินค้า 7' },   // teal
  { bg: 'rgba(249, 115, 22, 0.7)', border: 'rgb(234, 88, 12)', label: 'สินค้า 8' },    // orange
];

export default function BinPackingVisualization({ result, truck, cargoItems }: BinPackingVisualizationProps) {
  const [viewAngle, setViewAngle] = useState<'front' | 'top' | 'side' | '3d'>('3d');
  const [showLabels, setShowLabels] = useState(true);

  // Convert truck dimensions to cm
  const truckW = truck.dimensions.width * 100;
  const truckL = truck.dimensions.length * 100;
  const truckH = truck.dimensions.height * 100;

  // Scale factor: fit the truck into a ~400px view
  const maxDim = Math.max(truckW, truckL, truckH);
  const scale = 380 / maxDim;

  const scaledTruckW = truckW * scale;
  const scaledTruckL = truckL * scale;
  const scaledTruckH = truckH * scale;

  // Group packed items by cargo index for coloring
  const cargoColorMap = new Map<number, number>();
  let colorIdx = 0;
  result.items.forEach(item => {
    if (!cargoColorMap.has(item.cargoIndex)) {
      cargoColorMap.set(item.cargoIndex, colorIdx % CARGO_COLORS.length);
      colorIdx++;
    }
  });

  // Build placement data with labels
  interface PlacementInfo {
    x: number;
    y: number;
    z: number;
    w: number;
    l: number;
    h: number;
    cargoIndex: number;
    colorIdx: number;
    label: string;
    origW: number;
    origL: number;
    origH: number;
  }

  const placements: PlacementInfo[] = result.items.map(item => {
    const cIdx = cargoColorMap.get(item.cargoIndex) ?? 0;
    const cargoItem = cargoItems[item.cargoIndex];
    return {
      x: item.position.x * scale,
      y: item.position.y * scale,
      z: item.position.z * scale,
      w: item.rotatedDimensions.width * scale,
      l: item.rotatedDimensions.length * scale,
      h: item.rotatedDimensions.height * scale,
      cargoIndex: item.cargoIndex,
      colorIdx: cIdx,
      label: cargoItem ? `รายการ ${item.cargoIndex + 1}` : `ชิ้น ${item.itemIndex + 1}`,
      origW: item.rotatedDimensions.width,
      origL: item.rotatedDimensions.length,
      origH: item.rotatedDimensions.height,
    };
  });

  // 3D CSS transform based on view angle
  const getContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: scaledTruckW,
      height: scaledTruckL,
      position: 'relative' as const,
    };

    if (viewAngle === '3d') {
      return {
        ...base,
        transform: 'perspective(800px) rotateX(-25deg) rotateY(25deg)',
        transformStyle: 'preserve-3d' as const,
      };
    }
    return base;
  };

  // Render item box
  const renderItem = (placement: PlacementInfo, idx: number) => {
    const color = CARGO_COLORS[placement.colorIdx];
    const itemStyle: React.CSSProperties = viewAngle === '3d'
      ? {
          position: 'absolute',
          left: placement.x,
          top: placement.y,
          width: placement.w,
          height: placement.l,
          backgroundColor: color.bg,
          border: `2px solid ${color.border}`,
          transform: `translateZ(${placement.z}px)`,
          transformStyle: 'preserve-3d',
          borderRadius: '2px',
        }
      : {
          position: 'absolute',
          backgroundColor: color.bg,
          border: `2px solid ${color.border}`,
          borderRadius: '2px',
        };

    // Adjust positioning based on view
    if (viewAngle === 'top') {
      // Top view: x = left->right, y = front->back (length)
      Object.assign(itemStyle, {
        left: placement.x,
        top: placement.y,
        width: placement.w,
        height: placement.l,
      });
    } else if (viewAngle === 'front') {
      // Front view: x = left->right, z = bottom->top
      Object.assign(itemStyle, {
        left: placement.x,
        bottom: placement.z,
        width: placement.w,
        height: placement.h,
      });
    } else if (viewAngle === 'side') {
      // Side view: y = left->right, z = bottom->top
      Object.assign(itemStyle, {
        left: placement.y,
        bottom: placement.z,
        width: placement.l,
        height: placement.h,
      });
    }

    return (
      <div
        key={idx}
        style={itemStyle}
        className="group cursor-pointer transition-all hover:brightness-110 hover:z-10"
        title={`${placement.label}: ${placement.origW}×${placement.origL}×${placement.origH} ซม.`}
      >
        {showLabels && (placement.w > 25 && placement.l > 15) && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className="text-[8px] font-bold text-white drop-shadow-sm leading-tight text-center px-0.5">
              {placement.label}
            </span>
          </div>
        )}
        {/* 3D top face */}
        {viewAngle === '3d' && (
          <div
            style={{
              position: 'absolute',
              width: placement.w,
              height: placement.h,
              bottom: '100%',
              left: 0,
              backgroundColor: color.bg,
              border: `1px solid ${color.border}`,
              transform: 'rotateX(90deg)',
              transformOrigin: 'bottom',
              opacity: 0.85,
            }}
          />
        )}
        {/* 3D right face */}
        {viewAngle === '3d' && (
          <div
            style={{
              position: 'absolute',
              width: placement.h,
              height: placement.l,
              left: '100%',
              top: 0,
              backgroundColor: color.bg,
              border: `1px solid ${color.border}`,
              transform: 'rotateY(90deg)',
              transformOrigin: 'left',
              opacity: 0.7,
            }}
          />
        )}
      </div>
    );
  };

  // Truck container outline
  const containerStyle = getContainerStyle();

  // Legend: unique cargo items
  const uniqueCargos = Array.from(cargoColorMap.entries()).map(([cargoIndex, colorIdx]) => {
    const cargoItem = cargoItems[cargoIndex];
    const count = result.items.filter(i => i.cargoIndex === cargoIndex).length;
    return {
      cargoIndex,
      colorIdx,
      label: cargoItem ? `รายการ ${cargoIndex + 1}` : `ชิ้น ${cargoIndex}`,
      dimensions: cargoItem ? `${cargoItem.width}×${cargoItem.length}×${cargoItem.height} ซม.` : '',
      quantity: cargoItem?.quantity ?? 1,
      packed: count,
      color: CARGO_COLORS[colorIdx],
    };
  });

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['3d', 'top', 'front', 'side'] as const).map(view => (
            <button
              key={view}
              onClick={() => setViewAngle(view)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewAngle === view
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {view === '3d' ? '🎲 3D' : view === 'top' ? '⬆️ มุมบน' : view === 'front' ? '👁️ ด้านหน้า' : '👈 ด้านข้าง'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
            showLabels ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🏷️ {showLabels ? 'ซ่อนชื่อ' : 'แสดงชื่อ'}
        </button>
      </div>

      {/* 3D Visualization */}
      <div className="bg-gradient-to-b from-slate-100 to-slate-200 rounded-xl p-6 flex justify-center overflow-hidden">
        <div className="relative" style={containerStyle}>
          {/* Truck container border */}
          <div
            className="absolute border-2 border-dashed border-slate-400 rounded-sm"
            style={{
              width: viewAngle === 'side' ? scaledTruckL : scaledTruckW,
              height: viewAngle === 'front' || viewAngle === 'side' ? scaledTruckH : scaledTruckL,
              ...(viewAngle === '3d' ? {
                width: scaledTruckW,
                height: scaledTruckL,
              } : {}),
            }}
          />

          {/* Placed items */}
          {placements.map((placement, idx) => renderItem(placement, idx))}
        </div>
      </div>

      {/* Truck Dimensions Label */}
      <div className="text-center text-xs text-gray-500">
        🚛 {truck.name} — ขนาด: {truck.dimensions.width}×{truck.dimensions.length}×{truck.dimensions.height} ม. (กว้าง×ยาว×สูง)
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-bold text-gray-700 text-sm mb-2">📋 รายการสินค้าที่วางในรถ</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {uniqueCargos.map((cargo) => (
            <div key={cargo.cargoIndex} className="flex items-center gap-2 bg-white rounded-lg p-2 border">
              <div
                className="w-5 h-5 rounded flex-shrink-0"
                style={{ backgroundColor: cargo.color.bg, border: `2px solid ${cargo.color.border}` }}
              />
              <div className="text-xs">
                <div className="font-medium text-gray-800">{cargo.label}</div>
                <div className="text-gray-500">
                  {cargo.dimensions} × {cargo.quantity} ชิ้น → วางได้ {cargo.packed} ชิ้น
                </div>
              </div>
            </div>
          ))}
        </div>
        {result.unfittedItems.length > 0 && (
          <div className="mt-2 text-xs text-red-600">
            ❌ วางไม่ได้ {result.unfittedItems.length} ชิ้น
          </div>
        )}
      </div>

      {/* Algorithm Explanation */}
      <details className="bg-blue-50 border border-blue-200 rounded-lg">
        <summary className="p-3 text-sm font-medium text-blue-800 cursor-pointer">
          🔍 วิธีการคำนวณ 3D Bin Packing
        </summary>
        <div className="p-3 pt-0 text-xs text-blue-700 space-y-2">
          <p>
            <strong>อัลกอริทึม:</strong> First Fit Decreasing (FFD) พร้อมการหมุน 6 ทิศทาง
          </p>
          <p>
            <strong>ขั้นตอน:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>เรียงสินค้าจากขนาดใหญ่ไปเล็ก (ตามปริมาตร)</li>
            <li>ลองวางสินค้าแต่ละชิ้นในพื้นที่ว่างที่เล็กที่สุดที่ใส่ได้ (Best Fit)</li>
            <li>ลองหมุนสินค้า 6 แบบ (สลับ กว้าง×ยาว×สูง) เพื่อหาท่าวางที่ดีที่สุด</li>
            <li>เมื่อวางสินค้าได้ จะตัดพื้นที่เหลือออกเป็น 3 ส่วน (ขวา, หน้า, บน)</li>
            <li>ตรวจสอบว่าไม่มีสินค้าทับซ้อนกัน</li>
          </ol>
          <p>
            <strong>พื้นที่ใช้ได้จริง:</strong> คูณด้วย usableSpace {truck.usableSpace}% (คิดจากทุกมิติ)
          </p>
          <p className="text-blue-500 italic">
            ⚠️ ผลลัพธ์เป็นการประมาณการ สินค้าจริงอาจวางได้ต่างเล็กน้อยขึ้นอยู่กับรูปทรงและการจัดเรียงจริง
          </p>
        </div>
      </details>
    </div>
  );
}
