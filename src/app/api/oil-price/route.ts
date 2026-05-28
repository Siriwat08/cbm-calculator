import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_PRICE = 50.54;
const HISTORY_KEY = 'oil-price-history';

// Edge Config helpers
function getEdgeConfigId(): string | undefined {
  return process.env.EDGE_CONFIG_ID;
}

function getApiToken(): string | undefined {
  return process.env.VERCEL_API_TOKEN;
}

// ===== Edge Config Read =====
async function getFromEdgeConfig<T>(key: string): Promise<T | null> {
  const edgeConfigId = getEdgeConfigId();
  const apiToken = getApiToken();

  if (!edgeConfigId || !apiToken) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${key}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

// ===== Edge Config Write =====
async function setToEdgeConfig(key: string, value: unknown): Promise<boolean> {
  const edgeConfigId = getEdgeConfigId();
  const apiToken = getApiToken();

  if (!edgeConfigId || !apiToken) {
    console.error('Missing EDGE_CONFIG_ID or VERCEL_API_TOKEN');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              operation: 'upsert',
              key: key,
              value: value,
            },
          ],
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Edge Config save error:', error);
    return false;
  }
}

// ===== Bangchak API =====
async function fetchFromBangchak(): Promise<{ date: string; price: number } | null> {
  try {
    const url = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const oilData = Array.isArray(data) ? data[0] : data;
    const oilList = typeof oilData.OilList === 'string'
      ? JSON.parse(oilData.OilList)
      : oilData.OilList;

    const diesel = oilList.find((oil: { OilName: string }) =>
      oil.OilName === 'ไฮดีเซล S'
    );

    if (diesel) {
      // Extract date from remark
      const remarkMatch = oilData.OilRemark2?.match(/วันที่\s*(\d+)\s*(\S+)\s*(\d+)/);
      let effectiveDate: string;

      if (remarkMatch) {
        const day = remarkMatch[1].padStart(2, '0');
        const thaiMonth = remarkMatch[2];

        const months: Record<string, string> = {
          'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
          'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
          'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
        };

        const month = months[thaiMonth] || '01';
        const buddhistYear = remarkMatch[3];
        // Convert Buddhist year to Christian year for ISO format
        const christianYear = parseInt(buddhistYear) - 543;
        effectiveDate = `${christianYear}-${month}-${day}`;
      } else {
        // Fallback: use today's date in ISO format
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear().toString();
        effectiveDate = `${year}-${month}-${day}`;
      }

      return { date: effectiveDate, price: diesel.PriceToday };
    }

    return null;
  } catch (error) {
    console.error('Bangchak API error:', error);
    return null;
  }
}

// ===== GET: Fetch current oil price =====
export async function GET() {
  try {
    // 1. Get history from Edge Config
    const history = await getFromEdgeConfig<{ date: string; price: number; manual?: boolean }[]>(HISTORY_KEY) || [];

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
      date: new Date().toISOString().split('T')[0],
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      livePrice: null,
    });

  } catch (error) {
    console.error('Oil price API error:', error);

    return NextResponse.json({
      date: new Date().toISOString().split('T')[0],
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      livePrice: null,
    });
  }
}

// ===== POST: Add/Update oil price (manual entry) =====
export async function POST(request: NextRequest) {
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

    // Get existing history
    const history = await getFromEdgeConfig<{ date: string; price: number; manual?: boolean }[]>(HISTORY_KEY) || [];

    // Use provided date or today's date in ISO format
    let priceDate = date;
    if (!priceDate) {
      const today = new Date();
      const day = today.getDate().toString().padStart(2, '0');
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const year = today.getFullYear().toString();
      priceDate = `${year}-${month}-${day}`;
    }

    // Validate date format
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

    // Keep only last 90 entries
    const trimmedHistory = history.slice(0, 90);

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
  try {
    const { searchParams } = new URL(request.url);
    const dateToDelete = searchParams.get('date');

    if (!dateToDelete) {
      return NextResponse.json(
        { error: 'กรุณาระบุวันที่ที่ต้องการลบ' },
        { status: 400 }
      );
    }

    const history = await getFromEdgeConfig<{ date: string; price: number; manual?: boolean }[]>(HISTORY_KEY) || [];
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
