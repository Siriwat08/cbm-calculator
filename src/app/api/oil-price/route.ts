import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://oil-price.bangchak.co.th/ApiGetOilPrice/JwtOilPrice');
    const data = await response.json();
    
    // Parse OilList JSON string
    const oilList = JSON.parse(data.OilList || '[]');
    
    // Find Hi-Diesel S
    const diesel = oilList.find((oil: { OilName: string }) => oil.OilName === 'ไฮดีเซล S');
    
    if (!diesel) {
      return NextResponse.json({ error: 'Diesel not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      date: data.OilPriceDate,
      price: diesel.PriceToday,
      priceYesterday: diesel.PriceYesterday,
      priceTomorrow: diesel.PriceTomorrow,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch oil price' }, { status: 500 });
  }
}
