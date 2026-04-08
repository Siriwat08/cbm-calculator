import { NextResponse } from 'next/server';
import { get, put } from '@vercel/edge-config';

const HISTORY_KEY = 'oil-price-history';

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
    console.error('Fetch oil price error:', error);
    return null;
  }
}

// ===== CRON HANDLER =====
export async function GET(request: Request) {
  // Verify authorization (ป้องกันการเรียกจากคนภายนอก)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Cron job started at:', new Date().toISOString());
    
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
    
    // 3. Check if this date already exists
    const exists = history.some(h => h.date === currentPrice.date);
    
    if (!exists) {
      // 4. Add new price at the top, keep only 5
      history = [currentPrice, ...history].slice(0, 5);
      
      // 5. Save to Edge Config
      await put(HISTORY_KEY, history);
      
      console.log('Oil price saved:', currentPrice);
      
      return NextResponse.json({
        success: true,
        message: 'Oil price saved successfully',
        date: currentPrice.date,
        price: currentPrice.price,
        history: history,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Oil price already exists for today',
      date: currentPrice.date,
      price: currentPrice.price,
    });

  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal error' 
    }, { status: 500 });
  }
}
