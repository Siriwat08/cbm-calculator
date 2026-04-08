import { NextResponse } from 'next/server';
import { get } from '@vercel/edge-config';

const HISTORY_KEY = 'oil-price-history';

// ===== EDGE CONFIG REST API =====
async function saveToEdgeConfig(history: { date: string; price: number }[]): Promise<boolean> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;

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
              key: HISTORY_KEY,
              value: history,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Edge Config API error:', error);
      return false;
    }

    console.log('Saved to Edge Config successfully');
    return true;
  } catch (error) {
    console.error('Edge Config save error:', error);
    return false;
  }
}

// ===== BANGCHAK API =====
async function fetchOilPrice(): Promise<{ date: string; price: number } | null> {
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
      // ✅ ใช้วันที่ปัจจุบันแทนวันที่จาก API
      const today = new Date();
      const day = today.getDate().toString().padStart(2, '0');
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const year = (today.getFullYear() + 543).toString(); // แปลงเป็น พ.ศ.
      const currentDate = `${day}/${month}/${year}`;
      
      return { date: currentDate, price: diesel.PriceToday };
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
    // 1. Fetch current price
    const currentPrice = await fetchOilPrice();
    
    if (!currentPrice) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch oil price' 
      }, { status: 500 });
    }

    // 2. Get existing history
    let history = await get<{ date: string; price: number }[]>(HISTORY_KEY) || [];
    
    // 3. ✅ บันทึกทุกวัน ใช้วันที่ปัจจุบัน
    const existingIndex = history.findIndex(h => h.date === currentPrice.date);
    
    if (existingIndex === -1) {
      // วันที่ยังไม่มี → เพิ่มใหม่ด้านบน
      history = [currentPrice, ...history].slice(0, 10); // เก็บ 10 วัน
      console.log('Adding new date:', currentPrice.date);
    } else {
      // วันที่มีแล้ว → อัพเดทราคา
      history[existingIndex] = currentPrice;
      console.log('Updated price for:', currentPrice.date);
    }
    
    // 4. Save to Edge Config
    const saved = await saveToEdgeConfig(history);
    
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
