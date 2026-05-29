import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_PRICE = 50.54;
const HISTORY_KEY = 'oil-price-history';
const LEGACY_KEY = 'oil-price'; // Old single-value key

// ===== API Key Auth =====
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    new URL(request.url).searchParams.get('apiKey');

  // Allow if ADMIN_API_KEY env var is not set (development mode)
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return true;

  return apiKey === adminKey;
}

function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาระบุ API Key' },
    { status: 401 }
  );
}

// ===== Date Migration: Thai (DD/MM/BBBB) → ISO (YYYY-MM-DD) =====
function convertThaiDateToISO(dateStr: string): string {
  if (!dateStr) return dateStr;

  // Already ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Thai format (DD/MM/BBBB) e.g. "27/05/2569"
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, yearStr] = parts;
      const year = parseInt(yearStr);
      if (!isNaN(year)) {
        // If Buddhist era (> 2400), convert to Christian era
        const christianYear = year > 2400 ? year - 543 : year;
        return `${christianYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }

  // Return as-is if can't parse
  return dateStr;
}

// ===== Normalize any Edge Config data into a proper history array =====
// Edge Config might contain: null, number, object, or array (old or new format)
function normalizeToHistoryArray(
  raw: unknown
): { date: string; price: number; manual?: boolean }[] {
  // 1. Null/undefined/empty → empty array
  if (raw === null || raw === undefined) return [];

  // 2. Already a valid array
  if (Array.isArray(raw)) {
    // Filter out invalid entries
    return raw.filter(
      (item) => item && typeof item === 'object' && typeof item.price === 'number'
    ) as { date: string; price: number; manual?: boolean }[];
  }

  // 3. Single number (legacy format: just stored 50.54)
  if (typeof raw === 'number') {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear().toString();
    return [{ date: `${year}-${month}-${day}`, price: raw }];
  }

  // 4. Single object (legacy format: {date, price})
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.price === 'number') {
      const dateStr = typeof obj.date === 'string' ? obj.date : new Date().toISOString().split('T')[0];
      return [{ date: convertThaiDateToISO(dateStr), price: obj.price, manual: obj.manual === true }];
    }
  }

  // 5. String that might be a number
  if (typeof raw === 'string') {
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      const today = new Date();
      const day = today.getDate().toString().padStart(2, '0');
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const year = today.getFullYear().toString();
      return [{ date: `${year}-${month}-${day}`, price: num }];
    }
  }

  // 6. Unknown format → empty array
  console.warn('Unknown Edge Config data format:', typeof raw, raw);
  return [];
}

/**
 * Migrate old history entries that use Thai dates to ISO format.
 * Returns the migrated history array.
 * If any entry was converted, auto-saves back to Edge Config.
 */
async function migrateHistoryDates(
  history: { date: string; price: number; manual?: boolean }[]
): Promise<{ date: string; price: number; manual?: boolean }[]> {
  if (!Array.isArray(history) || history.length === 0) return history;

  let needsSave = false;

  const migrated = history.map(entry => {
    const isoDate = convertThaiDateToISO(entry.date);
    if (isoDate !== entry.date) {
      needsSave = true;
      console.log(`Migrated date: ${entry.date} → ${isoDate}`);
      return { ...entry, date: isoDate };
    }
    return entry;
  });

  if (needsSave) {
    console.log('Auto-migrating history dates to ISO format...');
    const saved = await setToEdgeConfig(HISTORY_KEY, migrated);
    if (saved) {
      console.log('Migration saved successfully');
    } else {
      console.error('Migration save failed');
    }
  }

  return migrated;
}

/**
 * Migrate legacy Edge Config key ('oil-price') to the new format ('oil-price-history').
 * Returns any history found in the legacy key.
 */
async function migrateLegacyKey(): Promise<{ date: string; price: number; manual?: boolean }[] | null> {
  const edgeConfigId = getEdgeConfigId();
  const apiToken = getApiToken();
  if (!edgeConfigId || !apiToken) return null;

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${LEGACY_KEY}`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;

    const legacyData = await response.json();
    if (legacyData === null || legacyData === undefined) return null;

    console.log('Found legacy oil-price key, migrating to oil-price-history...');

    const migrated = normalizeToHistoryArray(legacyData);
    if (migrated.length > 0) {
      // Save to new key
      const saved = await setToEdgeConfig(HISTORY_KEY, migrated);
      if (saved) {
        console.log('Legacy data migrated to oil-price-history:', migrated);
        // Try to delete the old key
        try {
          await fetch(
            `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                items: [{ operation: 'delete', key: LEGACY_KEY }],
              }),
            }
          );
        } catch {
          // Ignore deletion failure
        }
      }
    }

    return migrated;
  } catch {
    return null;
  }
}

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
    console.warn('Missing EDGE_CONFIG_ID or VERCEL_API_TOKEN env vars');
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

    if (!response.ok) {
      console.warn(`Edge Config read failed for key "${key}": ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.error('Edge Config read error:', error);
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

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Edge Config save failed:', response.status, errorBody);
    }

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
        let buddhistYear = remarkMatch[3];
        // Handle 2-digit Buddhist year (e.g. "69" means 2569)
        if (buddhistYear.length <= 2) {
          buddhistYear = '25' + buddhistYear.padStart(2, '0');
        }
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

/**
 * Get oil price history from Edge Config with full defensive handling.
 * - Normalizes any data format to a proper array
 * - Migrates from legacy key if needed
 * - Migrates Thai dates to ISO
 */
async function getOilPriceHistory(): Promise<{ date: string; price: number; manual?: boolean }[]> {
  // 1. Try reading from the new key
  const rawData = await getFromEdgeConfig<unknown>(HISTORY_KEY);

  let history = normalizeToHistoryArray(rawData);

  // 2. If new key is empty, try migrating from legacy key
  if (history.length === 0) {
    const legacyHistory = await migrateLegacyKey();
    if (legacyHistory && legacyHistory.length > 0) {
      history = legacyHistory;
    }
  }

  // 3. Migrate Thai dates to ISO format
  if (history.length > 0) {
    history = await migrateHistoryDates(history);
  }

  // 4. Sort by date descending
  history.sort((a, b) => b.date.localeCompare(a.date));

  return history;
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
      const today = new Date();
      const day = today.getDate().toString().padStart(2, '0');
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const year = today.getFullYear().toString();
      priceDate = `${year}-${month}-${day}`;
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
    let history = await getOilPriceHistory();

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
