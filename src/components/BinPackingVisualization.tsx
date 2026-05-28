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
  { fill: '#3B82F6', stroke: '#1D4ED8', light: '#60A5FA', label: 'สินค้า 1' },   // blue
  { fill: '#10B981', stroke: '#047857', light: '#34D399', label: 'สินค้า 2' },   // emerald
  { fill: '#F59E0B', stroke: '#B45309', light: '#FBBF24', label: 'สินค้า 3' },    // amber
  { fill: '#EF4444', stroke: '#B91C1C', light: '#F87171', label: 'สินค้า 4' },    // red
  { fill: '#8B5CF6', stroke: '#6D28D9', light: '#A78BFA', label: 'สินค้า 5' },   // violet
  { fill: '#EC4899', stroke: '#BE185D', light: '#F472B6', label: 'สินค้า 6' },   // pink
  { fill: '#14B8A6', stroke: '#0D9488', light: '#2DD4BF', label: 'สินค้า 7' },   // teal
  { fill: '#F97316', stroke: '#C2410C', light: '#FB923C', label: 'สินค้า 8' },    // orange
];

type ViewMode = 'rear' | 'top' | 'side' | '3d';

export default function BinPackingVisualization({ result, truck, cargoItems }: BinPackingVisualizationProps) {
  const [viewAngle, setViewAngle] = useState<ViewMode>('rear');
  const [showLabels, setShowLabels] = useState(true);

  // Convert truck dimensions to cm
  const truckW = truck.dimensions.width * 100;  // left-right
  const truckL = truck.dimensions.length * 100;  // front-back (depth)
  const truckH = truck.dimensions.height * 100;  // top-bottom

  // Scale: fit into SVG viewport
  const maxDim = Math.max(truckW, truckL, truckH);
  const scale = 300 / maxDim;

  const sW = truckW * scale;
  const sL = truckL * scale;
  const sH = truckH * scale;

  // Group items by cargo index for coloring
  const cargoColorMap = new Map<number, number>();
  let colorIdx = 0;
  result.items.forEach(item => {
    if (!cargoColorMap.has(item.cargoIndex)) {
      cargoColorMap.set(item.cargoIndex, colorIdx % CARGO_COLORS.length);
      colorIdx++;
    }
  });

  // Build placement data
  interface PlacementInfo {
    x: number; y: number; z: number;
    w: number; l: number; h: number;
    cargoIndex: number; colorIdx: number;
    label: string;
    origW: number; origL: number; origH: number;
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

  // Calculate remaining space info
  const totalItemsVolume = placements.reduce((sum, p) => sum + (p.w * p.l * p.h), 0);
  const truckVolume = sW * sL * sH;
  const usedPercent = truckVolume > 0 ? (totalItemsVolume / truckVolume * 100) : 0;
  const freePercent = 100 - usedPercent;

  // ============ SVG RENDERING ============
  // Common padding
  const pad = 30;

  // --- Rear View (looking from the back into the truck) ---
  // Shows: width (left-right) x height (bottom-top)
  // Items are drawn back-to-front (deeper items first, closer items on top)
  const renderRearView = () => {
    const svgW = sW + pad * 2;
    const svgH = sH + pad * 2;
    // Sort by depth (y) - items further back drawn first
    const sorted = [...placements].sort((a, b) => a.y - b.y);

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto">
        {/* Truck container (rear opening) */}
        <rect x={pad} y={pad} width={sW} height={sH}
          fill="rgba(241,245,249,0.5)" stroke="#64748B" strokeWidth="3" rx="4" strokeDasharray="8,4" />
        {/* Floor line */}
        <line x1={pad} y1={pad + sH} x2={pad + sW} y2={pad + sH} stroke="#94A3B8" strokeWidth="2" />
        {/* Dimension labels */}
        <text x={pad + sW / 2} y={pad + sH + 20} textAnchor="middle" className="text-[10px] fill-gray-400">
          กว้าง {truck.dimensions.width} ม.
        </text>
        <text x={pad - 8} y={pad + sH / 2} textAnchor="middle" transform={`rotate(-90, ${pad - 8}, ${pad + sH / 2})`} className="text-[10px] fill-gray-400">
          สูง {truck.dimensions.height} ม.
        </text>

        {/* Items - deeper items first, closer items overlay */}
        {sorted.map((p, idx) => {
          const color = CARGO_COLORS[p.colorIdx];
          // Depth-based opacity: items further back are more transparent
          const depthRatio = p.y / sL;
          const opacity = 0.4 + 0.6 * (1 - depthRatio); // closer = more opaque
          const x = pad + p.x;
          const y = pad + (sH - p.z - p.h); // SVG y is top-down, z is bottom-up
          return (
            <g key={idx}>
              <rect x={x} y={y} width={p.w} height={p.h}
                fill={color.fill} fillOpacity={opacity}
                stroke={color.stroke} strokeWidth="1.5" rx="2" />
              {/* Depth shading: items further back slightly darker */}
              {depthRatio > 0.3 && (
                <rect x={x} y={y} width={p.w} height={p.h}
                  fill="black" fillOpacity={depthRatio * 0.15} rx="2" />
              )}
              {showLabels && p.w > 28 && p.h > 14 && (
                <text x={x + p.w / 2} y={y + p.h / 2 + 3} textAnchor="middle"
                  className="text-[7px] font-bold fill-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Remaining space indicator */}
        <rect x={pad} y={pad} width={sW} height={sH}
          fill="transparent" stroke="#10B981" strokeWidth="1" strokeDasharray="4,4" rx="4" />
      </svg>
    );
  };

  // --- Top View (looking down from above) ---
  // Shows: width (left-right) x length (front-back)
  const renderTopView = () => {
    const svgW = sW + pad * 2;
    const svgH = sL + pad * 2;

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto">
        {/* Truck container */}
        <rect x={pad} y={pad} width={sW} height={sL}
          fill="rgba(241,245,249,0.5)" stroke="#64748B" strokeWidth="3" rx="4" strokeDasharray="8,4" />
        {/* Front/rear labels */}
        <text x={pad + sW / 2} y={pad + sL + 18} textAnchor="middle" className="text-[10px] fill-gray-400">
          ← ท้ายรถ (ยาว {truck.dimensions.length} ม.) หน้ารถ →
        </text>

        {placements.map((p, idx) => {
          const color = CARGO_COLORS[p.colorIdx];
          // Height-based opacity: taller items more opaque
          const heightRatio = p.h / sH;
          const opacity = 0.5 + 0.5 * heightRatio;
          return (
            <g key={idx}>
              <rect x={pad + p.x} y={pad + p.y} width={p.w} height={p.l}
                fill={color.fill} fillOpacity={opacity}
                stroke={color.stroke} strokeWidth="1.5" rx="2" />
              {showLabels && p.w > 28 && p.l > 12 && (
                <text x={pad + p.x + p.w / 2} y={pad + p.y + p.l / 2 + 3} textAnchor="middle"
                  className="text-[7px] font-bold fill-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // --- Side View (looking from the side) ---
  // Shows: length (left-right) x height (bottom-top)
  const renderSideView = () => {
    const svgW = sL + pad * 2;
    const svgH = sH + pad * 2;

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto">
        {/* Truck container */}
        <rect x={pad} y={pad} width={sL} height={sH}
          fill="rgba(241,245,249,0.5)" stroke="#64748B" strokeWidth="3" rx="4" strokeDasharray="8,4" />
        <text x={pad + sL / 2} y={pad + sH + 20} textAnchor="middle" className="text-[10px] fill-gray-400">
          ← ท้ายรถ (ยาว {truck.dimensions.length} ม.) หน้ารถ →
        </text>

        {placements.map((p, idx) => {
          const color = CARGO_COLORS[p.colorIdx];
          const x = pad + p.y;
          const y = pad + (sH - p.z - p.h);
          return (
            <g key={idx}>
              <rect x={x} y={y} width={p.l} height={p.h}
                fill={color.fill} fillOpacity={0.75}
                stroke={color.stroke} strokeWidth="1.5" rx="2" />
              {showLabels && p.l > 28 && p.h > 14 && (
                <text x={x + p.l / 2} y={y + p.h / 2 + 3} textAnchor="middle"
                  className="text-[7px] font-bold fill-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // --- 3D Isometric View ---
  const render3DView = () => {
    // Isometric projection angles
    const angle = Math.PI / 6; // 30 degrees
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Project 3D point to 2D isometric
    const project = (x: number, y: number, z: number): [number, number] => {
      const px = (x - y) * cosA;
      const py = (x + y) * sinA - z;
      return [px, py];
    };

    // Calculate bounding box
    const corners = [
      project(0, 0, 0), project(sW, 0, 0), project(0, sL, 0), project(sW, sL, 0),
      project(0, 0, sH), project(sW, 0, sH), project(0, sL, sH), project(sW, sL, sH),
    ];
    const minX = Math.min(...corners.map(c => c[0]));
    const maxX = Math.max(...corners.map(c => c[0]));
    const minY = Math.min(...corners.map(c => c[1]));
    const maxY = Math.max(...corners.map(c => c[1]));

    const svgW = maxX - minX + pad * 2;
    const svgH = maxY - minY + pad * 2;
    const offsetX = -minX + pad;
    const offsetY = -minY + pad;

    // Draw truck wireframe
    const truckLines = [
      // Bottom face
      [project(0, 0, 0), project(sW, 0, 0)],
      [project(sW, 0, 0), project(sW, sL, 0)],
      [project(sW, sL, 0), project(0, sL, 0)],
      [project(0, sL, 0), project(0, 0, 0)],
      // Top face
      [project(0, 0, sH), project(sW, 0, sH)],
      [project(sW, 0, sH), project(sW, sL, sH)],
      [project(sW, sL, sH), project(0, sL, sH)],
      [project(0, sL, sH), project(0, 0, sH)],
      // Vertical edges
      [project(0, 0, 0), project(0, 0, sH)],
      [project(sW, 0, 0), project(sW, 0, sH)],
      [project(sW, sL, 0), project(sW, sL, sH)],
      [project(0, sL, 0), project(0, sL, sH)],
    ];

    // Sort items by depth for proper occlusion
    const sorted = [...placements].sort((a, b) => (a.x + a.y) - (b.x + b.y));

    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto">
        {/* Truck wireframe */}
        {truckLines.map(([from, to], idx) => (
          <line key={idx}
            x1={from[0] + offsetX} y1={from[1] + offsetY}
            x2={to[0] + offsetX} y2={to[1] + offsetY}
            stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="6,3" />
        ))}

        {/* Items as 3D boxes */}
        {sorted.map((p, idx) => {
          const color = CARGO_COLORS[p.colorIdx];
          const x = p.x, y = p.y, z = p.z, w = p.w, l = p.l, h = p.h;

          // Top face polygon
          const topFace = [
            project(x, y, z + h),
            project(x + w, y, z + h),
            project(x + w, y + l, z + h),
            project(x, y + l, z + h),
          ].map(p => `${p[0] + offsetX},${p[1] + offsetY}`).join(' ');

          // Front face polygon (facing viewer)
          const frontFace = [
            project(x, y, z),
            project(x + w, y, z),
            project(x + w, y, z + h),
            project(x, y, z + h),
          ].map(p => `${p[0] + offsetX},${p[1] + offsetY}`).join(' ');

          // Right face polygon
          const rightFace = [
            project(x + w, y, z),
            project(x + w, y + l, z),
            project(x + w, y + l, z + h),
            project(x + w, y, z + h),
          ].map(p => `${p[0] + offsetX},${p[1] + offsetY}`).join(' ');

          // Label position (center of top face)
          const labelPos = project(x + w / 2, y + l / 2, z + h);

          return (
            <g key={idx}>
              {/* Front face */}
              <polygon points={frontFace}
                fill={color.fill} fillOpacity={0.8}
                stroke={color.stroke} strokeWidth="1" />
              {/* Right face (darker) */}
              <polygon points={rightFace}
                fill={color.stroke} fillOpacity={0.5}
                stroke={color.stroke} strokeWidth="1" />
              {/* Top face (lighter) */}
              <polygon points={topFace}
                fill={color.light} fillOpacity={0.7}
                stroke={color.stroke} strokeWidth="1" />
              {/* Label */}
              {showLabels && w > 15 && l > 15 && (
                <text x={labelPos[0] + offsetX} y={labelPos[1] + offsetY - 2}
                  textAnchor="middle" className="text-[7px] font-bold fill-gray-800">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Dimension labels */}
        <text x={project(sW / 2, 0, -10)[0] + offsetX} y={project(sW / 2, 0, -10)[1] + offsetY}
          textAnchor="middle" className="text-[9px] fill-gray-400">
          กว้าง {truck.dimensions.width} ม.
        </text>
      </svg>
    );
  };

  // Legend data
  const uniqueCargos = Array.from(cargoColorMap.entries()).map(([cargoIndex, colorIdx]) => {
    const cargoItem = cargoItems[cargoIndex];
    const count = result.items.filter(i => i.cargoIndex === cargoIndex).length;
    return {
      cargoIndex, colorIdx,
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
          {([
            { key: 'rear' as ViewMode, label: '🚪 ด้านท้ายรถ', desc: 'มองจากท้ายรถเข้าไป' },
            { key: 'top' as ViewMode, label: '⬆️ มุมบน', desc: 'มองจากด้านบนลงมา' },
            { key: 'side' as ViewMode, label: '👁️ ด้านข้าง', desc: 'มองจากด้านข้าง' },
            { key: '3d' as ViewMode, label: '🎲 3D', desc: 'มุมมอง 3 มิติ' },
          ]).map(view => (
            <button
              key={view.key}
              onClick={() => setViewAngle(view.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewAngle === view.key
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
              title={view.desc}
            >
              {view.label}
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

      {/* Visualization Area */}
      <div className="bg-gradient-to-b from-slate-100 to-slate-200 rounded-xl p-4 flex justify-center overflow-hidden">
        {viewAngle === 'rear' && renderRearView()}
        {viewAngle === 'top' && renderTopView()}
        {viewAngle === 'side' && renderSideView()}
        {viewAngle === '3d' && render3DView()}
      </div>

      {/* Space Usage Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-200">
          <p className="text-[10px] text-gray-500">ใช้แล้ว</p>
          <p className="text-sm font-bold text-emerald-600">{usedPercent.toFixed(1)}%</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
          <p className="text-[10px] text-gray-500">พื้นที่ว่าง</p>
          <p className="text-sm font-bold text-blue-600">{freePercent.toFixed(1)}%</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-200">
          <p className="text-[10px] text-gray-500">วางได้</p>
          <p className="text-sm font-bold text-emerald-600">{result.items.length} ชิ้น</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center border border-red-200">
          <p className="text-[10px] text-gray-500">วางไม่ได้</p>
          <p className="text-sm font-bold text-red-600">{result.unfittedItems.length} ชิ้น</p>
        </div>
      </div>

      {/* View Description */}
      <div className="text-center text-xs text-gray-500">
        {viewAngle === 'rear' && '🚪 มุมมองจากด้านท้ายรถ — เหมือนเปิดประตูท้ายแล้วมองเข้าไป สินค้าที่อยู่ใกล้จะชัดกว่า'}
        {viewAngle === 'top' && '⬆️ มุมมองจากด้านบน — เห็นการกระจายตัวตามความยาวรถ'}
        {viewAngle === 'side' && '👁️ มุมมองจากด้านข้าง — เห็นความสูงของสินค้าในแต่ละตำแหน่ง'}
        {viewAngle === '3d' && '🎲 มุมมอง 3 มิติ — เห็นรูปร่างกล่องสินค้าทั้งหมด'}
        {' | '}🚛 {truck.name} — {truck.dimensions.width}×{truck.dimensions.length}×{truck.dimensions.height} ม. (กว้าง×ยาว×สูง)
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-bold text-gray-700 text-sm mb-2">📋 รายการสินค้าที่วางในรถ</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {uniqueCargos.map((cargo) => (
            <div key={cargo.cargoIndex} className="flex items-center gap-2 bg-white rounded-lg p-2 border">
              <div
                className="w-5 h-5 rounded flex-shrink-0"
                style={{ backgroundColor: cargo.color.fill, border: `2px solid ${cargo.color.stroke}` }}
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
          <p>
            <strong>มุมมองด้านท้ายรถ:</strong> แสดงภาพเหมือนเปิดประตูท้ายรถแล้วมองเข้าไป — สินค้าที่อยู่ใกล้ประตู (ด้านท้าย) จะชัดเจนกว่า สินค้าที่อยู่ลึกเข้าไปด้านในจะจางลงเพื่อแสดงความลึก
          </p>
          <p className="text-blue-500 italic">
            ⚠️ ผลลัพธ์เป็นการประมาณการ สินค้าจริงอาจวางได้ต่างเล็กน้อยขึ้นอยู่กับรูปทรงและการจัดเรียงจริง
          </p>
        </div>
      </details>
    </div>
  );
}
