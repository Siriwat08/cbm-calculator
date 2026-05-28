import { NextResponse } from 'next/server';

const HISTORY_KEY = 'oil-price-history';

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
      // Extract date from remark for accurate date
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
        // Handle 2-digit Buddhist year (e.g. "69" means 2569)
        if (buddhistYear.length <= 2) {
          buddhistYear = '25' + buddhistYear.padStart(2, '0');
        }
        const christianYear = parseInt(buddhistYear) - 543;
        isoDate = `${christianYear}-${month}-${day}`;
      } else {
        // Fallback: use today's date in ISO format
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

// ===== CRON HANDLER =====
export async function GET() {
  console.log('Cron job started at:', new Date().toISOString());

  try {
    const currentPrice = await fetchOilPrice();

    if (!currentPrice) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch oil price'
      }, { status: 500 });
    }

    let history = await getFromEdgeConfig<{ date: string; price: number }[]>(HISTORY_KEY) || [];

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
