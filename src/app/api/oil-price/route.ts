import { NextResponse } from 'next/server';
import { get } from '@vercel/edge-config';

const FALLBACK_PRICE = 50.54;
const HISTORY_KEY = 'oil-price-history';

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
    
    // 2. Get history from Edge Config
    const history = await get<{ date: string; price: number }[]>(HISTORY_KEY) || [];
    
    // 3. Return response
    if (history.length > 0) {
      return NextResponse.json({
        date: history[0].date,
        price: history[0].price,
        history: history,
        source: 'edge-config',
      });
    }
    
    // 4. Fallback: use current price if no history
    if (currentPrice) {
      return NextResponse.json({
        date: currentPrice.date,
        price: currentPrice.price,
        history: [currentPrice],
        source: 'bangchak-api',
      });
    }
    
    // 5. Final fallback
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
    });

  } catch (error) {
    console.error('Oil price API error:', error);
    
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
    });
  }
}
