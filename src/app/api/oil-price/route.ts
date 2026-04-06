import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice');
    const data = await response.json();
    const oilList = JSON.parse(data.OilList || '[]');
    const diesel = oilList.find((oil: { OilName: string }) => oil.OilName === 'ไฮดีเซล S');
    
    if (diesel) {
      return NextResponse.json({
        date: data.OilPriceDate,
        price: diesel.PriceToday,
        history: [],
        source: 'bangchak-api'
      });
    }
    
    return NextResponse.json({ error: 'Diesel not found' });
  } catch (error) {
    return NextResponse.json({ error: 'API failed' }, { status: 500 });
  }
}
