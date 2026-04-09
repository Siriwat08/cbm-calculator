import { NextResponse } from 'next/server';
import { get } from '@vercel/edge-config';

const HISTORY_KEY = 'oil-price-history';
const FALLBACK_PRICE = 50.54;

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
      // ใช้วันที่ปัจจุบัน (สำหรับ Key ในการค้นหา)
      const today = new Date();
      const day = today.getDate().toString().padStart(2, '0');
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const year = (today.getFullYear() + 543).toString();
      const currentDate = `${day}/${month}/${year}`;
      
      return { date: currentDate, price: diesel.PriceToday };
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
    // 1. Get history from Edge Config (ข้อมูลหลัก)
    const history = await get<{ date: string; price: number }[]>(HISTORY_KEY) || [];
    
    // 2. Return history
    if (history.length > 0) {
      return NextResponse.json({
        date: history[0].date,
        price: history[0].price,
        history: history,
        source: 'edge-config',
      });
    }
    
    // 3. Fallback: Fetch from Bangchak if no history
    const currentPrice = await fetchFromBangchak();
    
    if (currentPrice) {
      return NextResponse.json({
        date: currentPrice.date,
        price: currentPrice.price,
        history: [currentPrice],
        source: 'bangchak-api',
      });
    }
    
    // 4. Final fallback
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
