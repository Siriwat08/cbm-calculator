import { NextRequest, NextResponse } from 'next/server';

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
        const christianYear = year > 2400 ? year - 543 : year;
        return `${christianYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }

  return dateStr;
}

// ===== Normalize any Edge Config data into a proper history array =====
function normalizeToHistoryArray(
  raw: unknown
): { date: string; price: number; manual?: boolean }[] {
  if (raw === null || raw === undefined) return [];

  if (Array.isArray(raw)) {
    return raw.filter(
      (item) => item && typeof item === 'object' && typeof item.price === 'number'
    ) as { date: string; price: number; manual?: boolean }[];
  }

  if (typeof raw === 'number') {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear().toString();
    return [{ date: `${year}-${month}-${day}`, price: raw }];
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.price === 'number') {
      const dateStr = typeof obj.date === 'string' ? obj.date : new Date().toISOString().split('T')[0];
      return [{ date: convertThaiDateToISO(dateStr), price: obj.price, manual: obj.manual === true }];
    }
  }

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

  console.warn('Unknown Edge Config data format:', typeof raw, raw);
  return [];
}

// Migrate old history entries that use Thai dates to ISO format
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
 */
async function migrateLegacyKey(): Promise<{ date: string; price: number; manual?: boolean }[] | null> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;
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
      const saved = await setToEdgeConfig(HISTORY_KEY, migrated);
      if (saved) {
        console.log('Legacy data migrated to oil-price-history:', migrated);
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

// ===== Edge Config Read =====
async function getFromEdgeConfig<T>(key: string): Promise<T | null> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;

  if (!edgeConfigId || !apiToken) return null;

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${key}`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
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
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;

  if (!edgeConfigId || !apiToken) return false;

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
          items: [{ operation: 'upsert', key, value }],
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
async function fetchOilPrice(): Promise<{ date: string; price: number } | null> {
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
      const remarkMatch = oilData.OilRemark2?.match(/วันที่\s*(\d+)\s*(\S+)\s*(\d+)/);
      let isoDate: string;

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
        if (buddhistYear.length <= 2) {
          buddhistYear = '25' + buddhistYear.padStart(2, '0');
        }
        const christianYear = parseInt(buddhistYear) - 543;
        isoDate = `${christianYear}-${month}-${day}`;
      } else {
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear().toString();
        isoDate = `${year}-${month}-${day}`;
      }

      return { date: isoDate, price: diesel.PriceToday };
    }

    return null;
  } catch (error) {
    console.error('Fetch oil price error:', error);
    return null;
  }
}

/**
 * Get oil price history from Edge Config with full defensive handling.
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

// ===== CRON HANDLER =====
export async function GET(request: NextRequest) {
  // Auth check for manual cron triggers (Vercel cron sends vercel cron header)
  const isVercelCron = request.headers.get('vercel-cron') === 'true';
  if (!isVercelCron && !validateApiKey(request)) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาระบุ API Key' },
      { status: 401 }
    );
  }

  console.log('Cron job started at:', new Date().toISOString());

  try {
    const currentPrice = await fetchOilPrice();

    // Get existing history (with defensive handling)
    let history = await getOilPriceHistory();

    if (!currentPrice) {
      // If Bangchak API fails, try to use latest history price
      if (history.length > 0) {
        console.log('Bangchak API failed, keeping latest history price');
        return NextResponse.json({
          success: true,
          message: 'Bangchak API unavailable, kept latest stored price',
          date: history[0].date,
          price: history[0].price,
          history: history,
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch oil price and no history available'
      }, { status: 500 });
    }

    const existingIndex = history.findIndex(h => h.date === currentPrice.date);

    if (existingIndex === -1) {
      history = [currentPrice, ...history].slice(0, 90);
      console.log('Adding new date:', currentPrice.date);
    } else {
      history[existingIndex] = currentPrice;
      console.log('Updated price for:', currentPrice.date);
    }

    const saved = await setToEdgeConfig(HISTORY_KEY, history);

    if (saved) {
      console.log('Oil price history saved:', history.length, 'days');

      return NextResponse.json({
        success: true,
        message: 'Oil price saved successfully',
        date: currentPrice.date,
        price: currentPrice.price,
        history: history,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to save to Edge Config',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal error'
    }, { status: 500 });
  }
}
