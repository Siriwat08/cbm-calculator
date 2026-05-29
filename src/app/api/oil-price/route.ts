import { NextRequest, NextResponse } from 'next/server';
import {
  validateApiKey,
  convertThaiDateToISO,
  getOilPriceHistory,
  setToEdgeConfig,
  fetchFromBangchak,
  getTodayISO,
  HISTORY_KEY,
  MAX_HISTORY_ENTRIES,
  FALLBACK_DIESEL_PRICE,
} from '@/lib/oil-price-api';

function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาระบุ API Key' },
    { status: 401 }
  );
}

// ===== GET: Fetch current oil price =====
export async function GET() {
  try {
    // 1. Get history from Edge Config (with full defensive handling)
    const history = await getOilPriceHistory();

    // 2. Try to fetch current price from Bangchak
    const currentPrice = await fetchFromBangchak();

    // 3. Return response - prioritize history (which may include manual entries)
    if (history.length > 0) {
      // Use the latest entry from history as the current price
      const latest = history[0];
      return NextResponse.json({
        date: latest.date,
        price: latest.price,
        history: history,
        source: 'edge-config',
        livePrice: currentPrice, // Also send live price for comparison
      });
    }

    // 4. No history - use Bangchak current price
    if (currentPrice) {
      return NextResponse.json({
        date: currentPrice.date,
        price: currentPrice.price,
        history: [currentPrice],
        source: 'bangchak-api',
        livePrice: currentPrice,
      });
    }

    // 5. Final fallback - use hardcoded value
    return NextResponse.json({
      date: getTodayISO(),
      price: FALLBACK_DIESEL_PRICE,
      history: [],
      source: 'fallback',
      livePrice: null,
    });

  } catch (error) {
    console.error('Oil price API error:', error);

    return NextResponse.json({
      date: getTodayISO(),
      price: FALLBACK_DIESEL_PRICE,
      history: [],
      source: 'fallback',
      livePrice: null,
    });
  }
}

// ===== POST: Add/Update oil price (manual entry) =====
export async function POST(request: NextRequest) {
  // Auth check
  if (!validateApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { price, date, manual = true } = body;

    // Validate input
    if (price === undefined || price === null) {
      return NextResponse.json(
        { error: 'กรุณาระบุราคา' },
        { status: 400 }
      );
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0 || numericPrice > 200) {
      return NextResponse.json(
        { error: 'ราคาต้องเป็นตัวเลขระหว่าง 0.01 - 200 บาท' },
        { status: 400 }
      );
    }

    // Get existing history (with defensive handling)
    let history = await getOilPriceHistory();

    // Use provided date or today's date in ISO format
    let priceDate = date;
    if (!priceDate) {
      priceDate = getTodayISO();
    } else {
      // Convert if Thai date provided
      priceDate = convertThaiDateToISO(priceDate);
    }

    // Validate date format (now must be ISO)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priceDate)) {
      return NextResponse.json(
        { error: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Create new price entry
    const newEntry = {
      date: priceDate,
      price: numericPrice,
      manual: manual !== false,
    };

    // Check if same date exists, update it
    const existingIndex = history.findIndex(entry => entry.date === priceDate);

    if (existingIndex !== -1) {
      history[existingIndex] = newEntry;
    } else {
      // Add new entry at the beginning, sorted by date descending
      history.unshift(newEntry);
      history.sort((a, b) => b.date.localeCompare(a.date));
    }

    // Keep only last N entries
    const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES);

    // Save to Edge Config
    const saved = await setToEdgeConfig(HISTORY_KEY, trimmedHistory);

    if (!saved) {
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกข้อมูลได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newEntry,
      message: existingIndex !== -1 ? 'อัปเดตราคาเรียบร้อย' : 'เพิ่มราคาใหม่เรียบร้อย',
    });

  } catch (error) {
    console.error('Error updating oil price:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตราคาน้ำมัน' },
      { status: 500 }
    );
  }
}

// ===== DELETE: Remove oil price entry =====
export async function DELETE(request: NextRequest) {
  // Auth check
  if (!validateApiKey(request)) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    let dateToDelete = searchParams.get('date');

    if (!dateToDelete) {
      return NextResponse.json(
        { error: 'กรุณาระบุวันที่ที่ต้องการลบ' },
        { status: 400 }
      );
    }

    // Convert Thai date to ISO if needed
    dateToDelete = convertThaiDateToISO(dateToDelete);

    // Get history with defensive handling
    const history = await getOilPriceHistory();

    const filteredHistory = history.filter(entry => entry.date !== dateToDelete);

    if (filteredHistory.length === history.length) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลสำหรับวันที่ที่ระบุ' },
        { status: 404 }
      );
    }

    const saved = await setToEdgeConfig(HISTORY_KEY, filteredHistory);

    if (!saved) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบข้อมูลได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ลบข้อมูลเรียบร้อย',
    });

  } catch (error) {
    console.error('Error deleting oil price:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล' },
      { status: 500 }
    );
  }
}
