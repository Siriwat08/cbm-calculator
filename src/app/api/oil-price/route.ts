import { NextResponse } from 'next/server';
import { getOilPriceHistory, saveOilPrice, setCurrentOilPrice } from '@/lib/kv';

export async function GET() {
  try {
    let oilPrice = null;
    let oilDate = null;
    
    try {
      const response = await fetch('https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice');
      
      if (response.ok) {
        const data = await response.json();
        const oilList = JSON.parse(data.OilList || '[]');
        const diesel = oilList.find((oil: { OilName: string }) => oil.OilName === 'ไฮดีเซล S');
        
        if (diesel) {
          oilPrice = diesel.PriceToday;
          oilDate = data.OilPriceDate;
        }
      }
    } catch (e) {
      console.error('API Error:', e);
    }

    const history = await getOilPriceHistory();
    
    if (oilPrice && oilDate) {
      await setCurrentOilPrice(oilPrice);
      const newHistory = await saveOilPrice(oilDate, oilPrice);
      return NextResponse.json({ date: oilDate, price: oilPrice, history: newHistory, source: 'api' });
    }
    
    if (history.length > 0) {
      return NextResponse.json({ date: history[0].date, price: history[0].price, history, source: 'cache' });
    }
    
    return NextResponse.json({ error: 'No data', history: [] });
  } catch (error) {
    const history = await getOilPriceHistory();
    if (history.length > 0) {
      return NextResponse.json({ date: history[0].date, price: history[0].price, history, source: 'fallback' });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
