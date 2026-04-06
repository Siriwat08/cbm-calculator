import { NextResponse } from 'next/server';
import { getOilPriceHistory, saveOilPrice, setCurrentOilPrice } from '@/lib/kv';

export async function GET() {
  try {
    let oilPrice = null;
    let oilDate = null;
    
    // Try Bangchak API (easier than PTT SOAP)
    try {
      const response = await fetch('https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const oilList = JSON.parse(data.OilList || '[]');
        
        // Find Hi-Diesel S
        const diesel = oilList.find((oil: { OilName: string }) => 
          oil.OilName === 'ไฮดีเซล S' || oil.OilName.includes('ดีเซล')
        );
        
        if (diesel) {
          oilPrice = diesel.PriceToday;
          oilDate = data.OilPriceDate;
        }
      }
    } catch (apiError) {
      console.error('Bangchak API Error:', apiError);
    }

    // Get history from Redis
    const history = await getOilPriceHistory();
    
    // If we got new price from API, save it
    if (oilPrice && oilDate) {
      await setCurrentOilPrice(oilPrice);
      const newHistory = await saveOilPrice(oilDate, oilPrice);
      
      return NextResponse.json({
        date: oilDate,
        price: oilPrice,
        history: newHistory,
        source: 'bangchak-api',
      });
    }
    
    // If API failed, return history from Redis
    if (history.length > 0) {
      return NextResponse.json({
        date: history[0].date,
        price: history[0].price,
        history: history,
        source: 'cache',
      });
    }
    
    // Fallback
    return NextResponse.json({
      error: 'Could not fetch oil price from API',
      history: [],
      source: 'fallback',
    });

  } catch (error) {
    console.error('Oil price API error:', error);
    
    const history = await getOilPriceHistory();
    if (history.length > 0) {
      return NextResponse.json({
        date: history[0].date,
        price: history[0].price,
        history: history,
        source: 'fallback',
      });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch oil price',
      history: [],
    }, { status: 500 });
  }
}
