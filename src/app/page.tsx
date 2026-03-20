'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Truck, 
  Package, 
  Scale, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Box,
  Ruler,
  AlertCircle
} from 'lucide-react'

// Truck Types with real dimensions
const TRUCKS = [
  {
    id: 'pickup',
    name: 'รถกระบะตู้ทึบ',
    image: '/images/Screenshot_20260320_125706_OneDrive.jpg',
    width: 165,    // cm
    length: 230,   // cm
    height: 200,   // cm
    cbm: 6,
    maxWeight: 1500,
    usableSpace: 0.8,
    description: 'มีซุ้มล้อ → ใช้พื้นที่จริงประมาณ 80%'
  },
  {
    id: 'fourwheel',
    name: 'รถ 4 ล้อจัมโบ้',
    image: '/images/Screenshot_20260320_125652_OneDrive.jpg',
    width: 180,    // cm
    length: 320,   // cm
    height: 210,   // cm
    cbm: 11,
    maxWeight: 3000,
    usableSpace: 1,
    description: 'ไม่มีซุ้มล้อ → ใช้เต็มพื้นที่'
  },
  {
    id: 'sixwheel',
    name: 'รถ 6 ล้อ',
    image: '/images/Screenshot_20260320_125638_OneDrive.jpg',
    width: 240,    // cm
    length: 660,   // cm
    height: 235,   // cm
    cbm: 32,
    maxWeight: 6000,
    usableSpace: 0.9,
    description: 'ใช้พื้นที่จริงประมาณ 90%'
  }
]

// Item Interface
interface CargoItem {
  id: string
  width: string
  length: string
  height: string
  qty: string
  weight: string
}

// Dimension Check Result
interface DimensionCheck {
  fits: boolean
  dimension: string
  itemSize: number
  truckSize: number
}

// Storage Key
const STORAGE_KEY = 'cbm_calculator_data'

// Helper to load initial data
const loadSavedData = () => {
  if (typeof window === 'undefined') return { items: [{ id: '1', width: '', length: '', height: '', qty: '1', weight: '' }], selectedTruck: '' }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      return {
        items: data.items || [{ id: '1', width: '', length: '', height: '', qty: '1', weight: '' }],
        selectedTruck: data.selectedTruck || ''
      }
    }
  } catch (e) {
    console.error('Failed to load saved data:', e)
  }
  return { items: [{ id: '1', width: '', length: '', height: '', qty: '1', weight: '' }], selectedTruck: '' }
}

export default function CBMCalculator() {
  const [selectedTruck, setSelectedTruck] = useState<string>(() => loadSavedData().selectedTruck)
  const [items, setItems] = useState<CargoItem[]>(() => loadSavedData().items)
  const [result, setResult] = useState<{
    totalCBM: number
    totalWeight: number
    spaceUsed: number
    weightUsed: number
    canLoad: boolean
    cbmExceeded: number
    weightExceeded: number
    recommendedTruck: typeof TRUCKS[0] | null
    dimensionIssues: DimensionCheck[]
  } | null>(null)

  // Save data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, selectedTruck }))
  }, [items, selectedTruck])

  // Add new item
  const addItem = () => {
    const newItem: CargoItem = {
      id: Date.now().toString(),
      width: '',
      length: '',
      height: '',
      qty: '1',
      weight: ''
    }
    setItems([...items, newItem])
  }

  // Remove item
  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  // Update item
  const updateItem = (id: string, field: keyof CargoItem, value: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // Calculate CBM for single item
  const calculateItemCBM = (item: CargoItem): number => {
    const w = parseFloat(item.width) || 0
    const l = parseFloat(item.length) || 0
    const h = parseFloat(item.height) || 0
    const qty = parseFloat(item.qty) || 0
    return (w * l * h * qty) / 1000000
  }

  // Check if item dimensions fit in truck (considering rotation)
  const checkItemDimensions = (item: CargoItem, truck: typeof TRUCKS[0]): DimensionCheck[] => {
    const issues: DimensionCheck[] = []
    const w = parseFloat(item.width) || 0
    const l = parseFloat(item.length) || 0
    const h = parseFloat(item.height) || 0
    
    if (w === 0 || l === 0 || h === 0) return issues

    // Check all possible orientations
    const orientations = [
      [w, l, h], [w, h, l],
      [l, w, h], [l, h, w],
      [h, w, l], [h, l, w]
    ]

    // Check each dimension against truck
    const dimensions = [
      { name: 'ความกว้าง', truckSize: truck.width },
      { name: 'ความยาว', truckSize: truck.length },
      { name: 'ความสูง', truckSize: truck.height }
    ]

    // Find the best orientation (if any fits)
    let bestOrientation: number[] | null = null
    for (const [ow, ol, oh] of orientations) {
      if (ow <= truck.width && ol <= truck.length && oh <= truck.height) {
        bestOrientation = [ow, ol, oh]
        break
      }
    }

    // If no orientation fits, find what's too big
    if (!bestOrientation) {
      // Check each dimension and report issues
      if (w > truck.width && w > truck.length) {
        issues.push({ fits: false, dimension: 'ความกว้าง', itemSize: w, truckSize: truck.width })
      }
      if (l > truck.width && l > truck.length) {
        issues.push({ fits: false, dimension: 'ความยาว', itemSize: l, truckSize: truck.length })
      }
      if (h > truck.height && w > truck.height && l > truck.height) {
        issues.push({ fits: false, dimension: 'ความสูง', itemSize: h, truckSize: truck.height })
      }
      
      // If still no issues found, the combination doesn't fit
      if (issues.length === 0) {
        // Check the minimum dimension that doesn't fit
        const minW = Math.min(w, l, h)
        const maxW = Math.max(w, l, h)
        
        if (maxW > truck.length) {
          issues.push({ fits: false, dimension: 'ความยาว', itemSize: maxW, truckSize: truck.length })
        }
        if (minW > truck.width) {
          issues.push({ fits: false, dimension: 'ความกว้าง', itemSize: minW, truckSize: truck.width })
        }
      }
    }

    return issues
  }

  // Calculate total
  const calculateTotal = () => {
    let totalCBM = 0
    let totalWeight = 0

    items.forEach(item => {
      totalCBM += calculateItemCBM(item)
      const weight = parseFloat(item.weight) || 0
      totalWeight += weight * (parseFloat(item.qty) || 1)
    })

    return { totalCBM, totalWeight }
  }

  // Validate all items have required fields
  const validateItems = (): { valid: boolean; missingWeight: boolean; missingDimension: boolean } => {
    let missingWeight = false
    let missingDimension = false

    for (const item of items) {
      const w = parseFloat(item.width) || 0
      const l = parseFloat(item.length) || 0
      const h = parseFloat(item.height) || 0
      const weight = parseFloat(item.weight) || 0

      if (w === 0 || l === 0 || h === 0) {
        missingDimension = true
      }
      if (weight === 0) {
        missingWeight = true
      }
    }

    return { 
      valid: !missingWeight && !missingDimension, 
      missingWeight, 
      missingDimension 
    }
  }

  // Check truck capacity
  const checkTruck = () => {
    if (!selectedTruck) return

    const validation = validateItems()
    if (!validation.valid) {
      return
    }

    const { totalCBM, totalWeight } = calculateTotal()
    const truck = TRUCKS.find(t => t.id === selectedTruck)
    
    if (!truck) return

    // Check dimensions for all items
    const allDimensionIssues: DimensionCheck[] = []
    items.forEach(item => {
      const issues = checkItemDimensions(item, truck)
      allDimensionIssues.push(...issues)
    })

    const effectiveCBM = truck.cbm * truck.usableSpace
    const spaceUsed = (totalCBM / effectiveCBM) * 100
    const weightUsed = (totalWeight / truck.maxWeight) * 100

    const cbmExceeded = totalCBM > effectiveCBM ? totalCBM - effectiveCBM : 0
    const weightExceeded = totalWeight > truck.maxWeight ? totalWeight - truck.maxWeight : 0

    // Check if can load (CBM, weight, and dimensions)
    const cbmOk = totalCBM <= effectiveCBM
    const weightOk = totalWeight <= truck.maxWeight
    const dimensionsOk = allDimensionIssues.length === 0
    const canLoad = cbmOk && weightOk && dimensionsOk

    setResult({
      totalCBM,
      totalWeight,
      spaceUsed,
      weightUsed,
      canLoad,
      cbmExceeded,
      weightExceeded,
      recommendedTruck: null,
      dimensionIssues: allDimensionIssues
    })
  }

  // Recommend truck
  const recommendTruck = () => {
    const validation = validateItems()
    if (!validation.valid) {
      return
    }

    const { totalCBM, totalWeight } = calculateTotal()

    // Find smallest truck that can handle the load (CBM, weight, and dimensions)
    const suitableTruck = TRUCKS.find(truck => {
      const effectiveCBM = truck.cbm * truck.usableSpace
      const cbmOk = totalCBM <= effectiveCBM
      const weightOk = totalWeight <= truck.maxWeight
      
      // Check dimensions for all items
      const dimensionsOk = items.every(item => {
        const issues = checkItemDimensions(item, truck)
        return issues.length === 0
      })
      
      return cbmOk && weightOk && dimensionsOk
    })

    if (suitableTruck) {
      setSelectedTruck(suitableTruck.id)
      
      const effectiveCBM = suitableTruck.cbm * suitableTruck.usableSpace
      const spaceUsed = (totalCBM / effectiveCBM) * 100
      const weightUsed = (totalWeight / suitableTruck.maxWeight) * 100

      setResult({
        totalCBM,
        totalWeight,
        spaceUsed,
        weightUsed,
        canLoad: true,
        cbmExceeded: 0,
        weightExceeded: 0,
        recommendedTruck: suitableTruck,
        dimensionIssues: []
      })
    } else {
      // No truck can handle - show max truck with exceeded info
      const maxTruck = TRUCKS[TRUCKS.length - 1]
      const effectiveCBM = maxTruck.cbm * maxTruck.usableSpace
      const cbmExceeded = totalCBM > effectiveCBM ? totalCBM - effectiveCBM : 0
      const weightExceeded = totalWeight > maxTruck.maxWeight ? totalWeight - maxTruck.maxWeight : 0

      // Check dimension issues for max truck
      const dimensionIssues: DimensionCheck[] = []
      items.forEach(item => {
        const issues = checkItemDimensions(item, maxTruck)
        dimensionIssues.push(...issues)
      })

      setSelectedTruck(maxTruck.id)
      setResult({
        totalCBM,
        totalWeight,
        spaceUsed: (totalCBM / effectiveCBM) * 100,
        weightUsed: (totalWeight / maxTruck.maxWeight) * 100,
        canLoad: false,
        cbmExceeded,
        weightExceeded,
        recommendedTruck: null,
        dimensionIssues
      })
    }
  }

  // Reset all
  const resetAll = () => {
    setItems([{ id: '1', width: '', length: '', height: '', qty: '1', weight: '' }])
    setSelectedTruck('')
    setResult(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  // Get validation status for display
  const validation = validateItems()

  // Image popup state
  const [popupImage, setPopupImage] = useState<{ src: string; alt: string } | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-lg">
                <img 
                  src="/images/3_20251016_054221_0002.png" 
                  alt="Phaopanya Transport Logo" 
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">หจก.เผ่าปัญญา ทรานสปอร์ต</h1>
                <p className="text-blue-200 text-sm">CBM Calculator - คำนวณปริมาตรสินค้า</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        {/* Truck Selection */}
        <Card className="mb-6 border-2 border-blue-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-700 to-blue-800 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="w-5 h-5" />
              เลือกประเภทรถ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TRUCKS.map((truck) => (
                <button
                  key={truck.id}
                  onClick={() => setSelectedTruck(truck.id)}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                    selectedTruck === truck.id
                      ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-300'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  {/* Truck Image */}
                  <div 
                    className="relative w-full h-48 sm:h-52 mb-2 rounded-lg overflow-hidden bg-gray-100 cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPopupImage({ src: truck.image, alt: truck.name })
                    }}
                  >
                    <img 
                      src={truck.image} 
                      alt={truck.name}
                      className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                      style={{ objectPosition: 'top' }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    {/* Selected indicator */}
                    {selectedTruck === truck.id && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    {/* Click to view more text */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white/95 py-2 text-center group-hover:bg-white transition-colors">
                      <span className="text-blue-600 text-sm font-medium">กดเพื่อดูข้อมูลเพิ่มเติม</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className={`w-4 h-4 ${selectedTruck === truck.id ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className={`font-semibold text-sm ${selectedTruck === truck.id ? 'text-blue-700' : 'text-gray-700'}`}>
                      {truck.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      <span>{(truck.width/100).toFixed(2)} × {(truck.length/100).toFixed(2)} × {(truck.height/100).toFixed(2)} ม.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Box className="w-3 h-3" />
                      <span>CBM: {truck.cbm}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Scale className="w-3 h-3" />
                      <span>น้ำหนัก: {truck.maxWeight.toLocaleString()} kg</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cargo Items */}
        <Card className="mb-6 border-2 border-amber-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                รายการสินค้า
              </div>
              <Button
                onClick={addItem}
                variant="secondary"
                size="sm"
                className="bg-white text-amber-600 hover:bg-amber-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มสินค้า
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                    รายการที่ {index + 1}
                  </Badge>
                  {items.length > 1 && (
                    <Button
                      onClick={() => removeItem(item.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      ลบ
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-gray-600 text-sm">กว้าง (cm) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={item.width}
                      onChange={(e) => updateItem(item.id, 'width', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-600 text-sm">ยาว (cm) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={item.length}
                      onChange={(e) => updateItem(item.id, 'length', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-600 text-sm">สูง (cm) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={item.height}
                      onChange={(e) => updateItem(item.id, 'height', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-600 text-sm">จำนวน <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-600 text-sm">น้ำหนัก (kg) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={item.weight}
                      onChange={(e) => updateItem(item.id, 'weight', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                {item.width && item.length && item.height && item.qty && (
                  <div className="mt-2 text-sm text-gray-600 flex items-center gap-1">
                    <Box className="w-4 h-4" />
                    CBM รายการ: {calculateItemCBM(item).toFixed(4)} m³
                  </div>
                )}
              </div>
            ))}
            
            {/* Validation Warning */}
            {(validation.missingDimension || validation.missingWeight) && (
              <Alert className="border-red-300 bg-red-50">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <AlertDescription className="text-red-700">
                  <strong>⚠️ กรุณากรอกข้อมูลให้ครบถ้วน:</strong>
                  {validation.missingDimension && ' ขนาดสินค้า (กว้าง × ยาว × สูง)'}
                  {validation.missingWeight && ' น้ำหนัก'}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Total Summary */}
            {(() => {
              const { totalCBM, totalWeight } = calculateTotal()
              if (totalCBM > 0) {
                return (
                  <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-600">CBM รวม</p>
                        <p className="text-2xl font-bold text-blue-700">{totalCBM.toFixed(4)}</p>
                        <p className="text-xs text-gray-500">m³</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">น้ำหนักรวม</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {totalWeight > 0 ? totalWeight.toFixed(1) : '-'}
                        </p>
                        <p className="text-xs text-gray-500">kg</p>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Button
            onClick={checkTruck}
            disabled={!selectedTruck || !validation.valid}
            className="h-14 text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg disabled:opacity-50"
          >
            <Scale className="w-5 h-5 mr-2" />
            ตรวจสอบการบรรทุก
          </Button>
          <Button
            onClick={recommendTruck}
            disabled={!validation.valid}
            variant="outline"
            className="h-14 text-lg border-2 border-amber-400 text-amber-600 hover:bg-amber-50 shadow-lg disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            แนะนำรถอัตโนมัติ
          </Button>
          <Button
            onClick={resetAll}
            variant="outline"
            className="h-14 text-lg border-2 border-gray-300 text-gray-600 hover:bg-gray-50 shadow-lg"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            รีเซ็ต
          </Button>
        </div>

        {/* Results */}
        {result && (
          <Card className={`border-2 shadow-xl ${
            result.canLoad ? 'border-green-300' : 'border-red-300'
          }`}>
            <CardHeader className={`${
              result.canLoad 
                ? 'bg-gradient-to-r from-green-600 to-green-700' 
                : 'bg-gradient-to-r from-red-600 to-red-700'
            } text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-lg">
                {result.canLoad ? (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    สามารถบรรทุกได้
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6" />
                    บรรทุกไม่พอ
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <Package className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{result.totalCBM.toFixed(4)}</p>
                  <p className="text-sm text-gray-600">CBM รวม (m³)</p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <Scale className="w-6 h-6 mx-auto text-amber-600 mb-1" />
                  <p className="text-2xl font-bold text-amber-600">
                    {result.totalWeight.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-600">น้ำหนักรวม (kg)</p>
                </div>
              </div>

              {/* Selected Truck Info */}
              {selectedTruck && (() => {
                const truck = TRUCKS.find(t => t.id === selectedTruck)
                if (!truck) return null
                return (
                  <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-700">รถที่เลือก: {truck.name}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span>ขนาด: {(truck.width/100).toFixed(2)} × {(truck.length/100).toFixed(2)} × {(truck.height/100).toFixed(2)} ม. | </span>
                      <span>{truck.description}</span>
                    </div>
                  </div>
                )
              })()}

              {/* Dimension Issues */}
              {result.dimensionIssues.length > 0 && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="flex items-center gap-2 text-orange-700 mb-2">
                    <Ruler className="w-5 h-5" />
                    <span className="font-semibold">⚠️ ขนาดสินค้าเกินขนาดรถ:</span>
                  </div>
                  <ul className="space-y-1">
                    {result.dimensionIssues.map((issue, idx) => (
                      <li key={idx} className="text-sm text-orange-600">
                        ❌ {issue.dimension}: {issue.itemSize.toFixed(0)} cm &gt; {issue.truckSize} cm (เกิน {(issue.itemSize - issue.truckSize).toFixed(0)} cm)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Usage Bars */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-600">📊 ใช้พื้นที่</span>
                    <span className={`text-sm font-semibold ${
                      result.spaceUsed > 100 ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {result.spaceUsed.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(result.spaceUsed, 100)} 
                    className={`h-3 ${result.spaceUsed > 100 ? 'bg-red-100' : ''}`}
                  />
                  {result.cbmExceeded > 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      ❌ CBM เกิน {result.cbmExceeded.toFixed(4)} m³
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-600">⚖️ ใช้น้ำหนัก</span>
                    <span className={`text-sm font-semibold ${
                      result.weightUsed > 100 ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {result.weightUsed.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(result.weightUsed, 100)} 
                    className={`h-3 ${result.weightUsed > 100 ? 'bg-red-100' : ''}`}
                  />
                  {result.weightExceeded > 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      ❌ น้ำหนักเกิน {result.weightExceeded.toFixed(1)} kg
                    </p>
                  )}
                </div>
              </div>

              {/* Recommended Truck */}
              {result.recommendedTruck && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 text-green-700">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-semibold">🚛 รถที่แนะนำ: {result.recommendedTruck.name}</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    ขนาด: {(result.recommendedTruck.width/100).toFixed(2)} × {(result.recommendedTruck.length/100).toFixed(2)} × {(result.recommendedTruck.height/100).toFixed(2)} ม.
                  </p>
                </div>
              )}

              {/* If cannot load, show recommendation */}
              {!result.canLoad && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="font-semibold text-red-700 mb-2">🚛 แนะนำรถที่เหมาะสม:</p>
                  {(() => {
                    const { totalCBM, totalWeight } = calculateTotal()
                    const suitableTrucks = TRUCKS.filter(truck => {
                      const effectiveCBM = truck.cbm * truck.usableSpace
                      const cbmOk = totalCBM <= effectiveCBM
                      const weightOk = totalWeight <= truck.maxWeight
                      
                      // Check dimensions
                      const dimensionsOk = items.every(item => {
                        const issues = checkItemDimensions(item, truck)
                        return issues.length === 0
                      })
                      
                      return cbmOk && weightOk && dimensionsOk
                    })
                    
                    if (suitableTrucks.length === 0) {
                      return (
                        <div className="text-red-600">
                          <p className="font-medium">❌ ไม่มีรถที่รองรับได้</p>
                          <p className="text-sm mt-1">กรุณาแบ่งสินค้าเป็นหลายเที่ยว หรือใช้รถเช่าเหมาจ้างเพิ่มเติม</p>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="space-y-2">
                        {suitableTrucks.map(truck => (
                          <button
                            key={truck.id}
                            onClick={() => setSelectedTruck(truck.id)}
                            className="w-full p-3 bg-white border border-green-300 rounded-lg text-left hover:bg-green-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700">{truck.name}</span>
                              <Badge className="bg-green-100 text-green-700">เลือก</Badge>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              ขนาด: {(truck.width/100).toFixed(2)} × {(truck.length/100).toFixed(2)} × {(truck.height/100).toFixed(2)} ม. | CBM: {truck.cbm} | น้ำหนัก: {truck.maxWeight.toLocaleString()} kg
                            </p>
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <img 
                src="/images/3_20251016_054221_0002.png" 
                alt="Logo" 
                className="w-6 h-6 object-contain"
              />
              <span>หจก.เผ่าปัญญา ทรานสปอร์ต</span>
            </div>
            <div className="text-gray-400">
              CBM Calculator v2.0
            </div>
          </div>
        </div>
      </footer>

      {/* Image Popup Dialog */}
      {popupImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setPopupImage(null)}
        >
          <div className="relative max-w-4xl w-full mx-4">
            <button
              onClick={() => setPopupImage(null)}
              className="absolute -top-2 -right-2 z-10 bg-white text-gray-800 rounded-full p-2 hover:bg-gray-100 transition-colors shadow-lg"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <img
              src={popupImage.src}
              alt={popupImage.alt}
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
