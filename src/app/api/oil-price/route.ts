import { NextResponse } from 'next/server';
import { getOilPriceHistory, saveOilPrice, setCurrentOilPrice } from '@/lib/kv';

const FALLBACK_OIL_PRICE = 50.54;

export async function GET() {
  try {
    let oilPrice: number | null = null;
    let oilDate: string | null = null;
    
    // Try Bangchak API
    try {
      const response = await fetch('https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice', {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle both string and array format
        let oilList = data.OilList;
        if (typeof oilList === 'string') {
          oilList = JSON.parse(oilList);
        }
        
        const diesel = Array.isArray(oilList) 
          ? oilList.find((oil: { OilName: string }) => oil.OilName === 'ไฮดีเซล S')
          : null;
        
        if (diesel && diesel.PriceToday !== undefined && diesel.PriceToday !== null) {
          oilPrice = diesel.PriceToday;
          oilDate = data.OilPriceDate || new Date().toLocaleDateString('th-TH');
        }
      }
    } catch (e) {
      console.error('Bangchak API error:', e);
    }

    // Get history from Redis
    const history = await getOilPriceHistory();
    
    // Save if we got new price
    if (oilPrice !== null && oilDate) {
      await setCurrentOilPrice(oilPrice);
      const newHistory = await saveOilPrice(oilDate, oilPrice);
      return NextResponse.json({ 
        date: oilDate, 
        price: oilPrice, 
        history: newHistory, 
        source: 'api' 
      });
    }
    
    // Return from cache if API failed
    if (history.length > 0) {
      return NextResponse.json({ 
        date: history[0].date, 
        price: history[0].price, 
        history, 
        source: 'cache' 
      });
    }
    
    // Final fallback
    return NextResponse.json({ 
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_OIL_PRICE, 
      history: [], 
      source: 'fallback' 
    });
    
  } catch (error) {
    console.error('Oil price API error:', error);
    
    const history = await getOilPriceHistory();
    if (history.length > 0) {
      return NextResponse.json({ 
        date: history[0].date, 
        price: history[0].price, 
        history, 
        source: 'fallback' 
      });
    }
    
    return NextResponse.json({ 
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_OIL_PRICE, 
      history: [], 
      source: 'fallback' 
    });
  }
}
