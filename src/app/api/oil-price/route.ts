import { NextResponse } from 'next/server';
import { get, put } from '@vercel/edge-config';

const FALLBACK_PRICE = 50.54;
const HISTORY_KEY = 'oil-price-history';

// ===== EDGE CONFIG HELPERS =====
async function getHistory(): Promise<{ date: string; price: number }[]> {
  try {
    const history = await get<{ date: string; price: number }[]>(HISTORY_KEY);
    return history || [];
  } catch (error) {
    console.error('Edge Config get error:', error);
    return [];
  }
}

async function saveHistory(history: { date: string; price: number }[]): Promise<void> {
  try {
    await put(HISTORY_KEY, history);
  } catch (error) {
    console.error('Edge Config put error:', error);
  }
}

// ===== BANGCHAK API =====
async function fetchFromBangchak(): Promise<{ date: string; price: number } | null> {
  try {
    const url = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
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
      // ดึงวันที่มีผลจาก OilRemark2
      const remarkMatch = oilData.OilRemark2?.match(/วันที่\s*(\d+)\s*(\S+)\s*(\d+)/);
      let effectiveDate = oilData.OilPriceDate;
      
      if (remarkMatch) {
        const day = remarkMatch[1].padStart(2, '0');
        const thaiMonth = remarkMatch[2];
        
        const months: { [key: string]: string } = {
          'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
          'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
          'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
        };
        
        const month = months[thaiMonth] || '01';
        const year = remarkMatch[3];
        effectiveDate = `${day}/${month}/${year}`;
      }
      
      return { date: effectiveDate, price: diesel.PriceToday };
    }
    
    return null;
  } catch (error) {
    console.error('Bangchak API error:', error);
    return null;
  }
}

// ===== MAIN HANDLER =====
export async function GET() {
  try {
    // 1. Get current price from Bangchak
    const currentPrice = await fetchFromBangchak();
    
    // 2. Get existing history from Edge Config
    let history = await getHistory();
    
    // 3. If we have new price, add to history
    if (currentPrice) {
      const exists = history.some(h => h.date === currentPrice.date);
      
      if (!exists) {
        // Add new price at the top, keep only 5
        history = [currentPrice, ...history].slice(0, 5);
        
        // Save to Edge Config
        await saveHistory(history);
      }
    }
    
    // 4. Return response
    if (history.length > 0) {
      return NextResponse.json({
        date: history[0].date,
        price: history[0].price,
        history: history,
        source: 'bangchak-api',
      });
    }
    
    // Fallback if no history
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [{ date: new Date().toLocaleDateString('th-TH'), price: FALLBACK_PRICE }],
      source: 'fallback',
    });

  } catch (error) {
    console.error('Oil price API error:', error);
    
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
