import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Try multiple API endpoints
    const endpoints = [
      'https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice',
      'https://oil-price.bangchak.co.th/ApiGetOilPrice/JwtOilPrice',
    ];

    let data = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          data = await response.json();
          break;
        }
      } catch (e) {
        console.error(`Failed to fetch from ${url}:`, e);
        continue;
      }
    }

    if (!data) {
      // Return fallback data if API fails
      return NextResponse.json({
        date: new Date().toLocaleDateString('th-TH'),
        price: 33.50,
        history: [],
        source: 'fallback',
        error: 'Could not fetch from any API endpoint'
      });
    }

    // Parse oil list (handle both string and object)
    let oilList = data.OilList;
    if (typeof oilList === 'string') {
      oilList = JSON.parse(oilList);
    }

    // Find diesel
    const diesel = Array.isArray(oilList) 
      ? oilList.find((oil: { OilName: string }) => 
          oil.OilName === 'ไฮดีเซล S' || 
          oil.OilName?.includes('ดีเซล')
        )
      : null;

    if (diesel && diesel.PriceToday !== undefined) {
      return NextResponse.json({
        date: data.OilPriceDate || new Date().toLocaleDateString('th-TH'),
        price: diesel.PriceToday,
        history: [],
        source: 'bangchak-api'
      });
    }

    // If diesel not found, return fallback
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: 33.50,
      history: [],
      source: 'fallback',
      error: 'Diesel price not found in response'
    });

  } catch (error) {
    console.error('Oil price API error:', error);
    
    // Always return a valid response
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: 33.50,
      history: [],
      source: 'fallback',
      error: 'API request failed'
    });
  }
}
