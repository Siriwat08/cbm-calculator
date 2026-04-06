import { NextResponse } from 'next/server';

// Correct fallback price (current diesel price)
const FALLBACK_PRICE = 50.54;

export async function GET() {
  try {
    // Try Bangchak API with better error handling
    const apiUrl = 'https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice';
    
    console.log('Fetching from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CBMCalculator/1.0)',
      },
      cache: 'no-store',
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response keys:', Object.keys(data));
    console.log('OilPriceDate:', data.OilPriceDate);

    // Parse oil list
    let oilList = data.OilList;
    console.log('OilList type:', typeof oilList);
    
    if (typeof oilList === 'string') {
      console.log('Parsing OilList string...');
      oilList = JSON.parse(oilList);
    }

    console.log('OilList length:', Array.isArray(oilList) ? oilList.length : 'not array');

    // Find diesel - try multiple names
    const dieselNames = [
      'ไฮดีเซล S',
      'ไฮดีเซล',
      'ดีเซล',
      'Diesel',
      'Hi-Diesel S'
    ];

    let diesel = null;
    for (const name of dieselNames) {
      diesel = Array.isArray(oilList) 
        ? oilList.find((oil: { OilName?: string; PRODUCT?: string }) => 
            oil.OilName?.includes(name) || oil.PRODUCT?.includes(name)
          )
        : null;
      if (diesel) {
        console.log('Found diesel with name:', name);
        break;
      }
    }

    if (diesel) {
      const price = diesel.PriceToday || diesel.PRICE || diesel.price || FALLBACK_PRICE;
      console.log('Diesel price:', price);
      
      return NextResponse.json({
        date: data.OilPriceDate || new Date().toLocaleDateString('th-TH'),
        price: price,
        history: [],
        source: 'bangchak-api',
        debug: {
          oilName: diesel.OilName || diesel.PRODUCT,
          foundWith: dieselNames.find(n => diesel.OilName?.includes(n) || diesel.PRODUCT?.includes(n))
        }
      });
    }

    // Log all oil names for debugging
    if (Array.isArray(oilList)) {
      console.log('Available oil names:', oilList.map((o: { OilName?: string }) => o.OilName));
    }

    // Return fallback with correct price
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      error: 'Diesel not found in oil list',
      debug: {
        oilListLength: Array.isArray(oilList) ? oilList.length : 0,
        firstFew: Array.isArray(oilList) ? oilList.slice(0, 3) : null
      }
    });

  } catch (error) {
    console.error('Oil price API error:', error);
    
    // Return correct fallback price
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
