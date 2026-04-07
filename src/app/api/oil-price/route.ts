import { NextResponse } from 'next/server';

const FALLBACK_PRICE = 50.54;

export async function GET() {
  try {
    // Bangchak Web Service URL (จากวิดีโอ)
    const url = 'https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice';
    
    console.log('Fetching from Bangchak:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('Response status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Get response as text (XML format)
    const xmlText = await response.text();
    console.log('Response length:', xmlText.length);
    
    // Parse XML to find diesel price
    // XML structure: <type>ชื่อน้ำมัน</type><today>ราคา</today>
    
    // Find all oil entries in XML
    const oilEntries = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    console.log('Found oil entries:', oilEntries.length);
    
    // Find diesel entry
    for (const entry of oilEntries) {
      const typeMatch = entry.match(/<type><!\[CDATA\[(.*?)\]\]><\/type>/) || entry.match(/<type>(.*?)<\/type>/);
      const todayMatch = entry.match(/<today>(.*?)<\/today>/);
      
      if (typeMatch && todayMatch) {
        const oilName = typeMatch[1];
        const price = parseFloat(todayMatch[1]);
        
        console.log('Found:', oilName, '->', price);
        
        // Find Hi-Diesel S or Diesel
        if (oilName.includes('ไฮดีเซล S') || oilName.includes('ดีเซล')) {
          // Extract date from remark_th
          const remarkMatch = entry.match(/<remark_th><!\[CDATA\[(.*?)\]\]><\/remark_th>/) || entry.match(/<remark_th>(.*?)<\/remark_th>/);
          const date = remarkMatch ? remarkMatch[1] : new Date().toLocaleDateString('th-TH');
          
          return NextResponse.json({
            date: date,
            price: price,
            history: [],
            source: 'bangchak-api',
            oilName: oilName,
          });
        }
      }
    }
    
    // Alternative: Try JSON API
    console.log('Trying JSON API...');
    const jsonResponse = await fetch('https://oil-price.bangchak.co.th/ApiGetOilPrice/GetOilPrice', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (jsonResponse.ok) {
      const data = await jsonResponse.json();
      console.log('JSON response keys:', Object.keys(data));
      
      let oilList = data.OilList;
      if (typeof oilList === 'string') {
        oilList = JSON.parse(oilList);
      }
      
      if (Array.isArray(oilList)) {
        console.log('OilList items:', oilList.length);
        console.log('First few oils:', oilList.slice(0, 3).map((o: { OilName?: string }) => o.OilName));
        
        const diesel = oilList.find((oil: { OilName?: string }) => 
          oil.OilName === 'ไฮดีเซล S' || 
          oil.OilName?.includes('ดีเซล')
        );
        
        if (diesel) {
          return NextResponse.json({
            date: data.OilPriceDate || new Date().toLocaleDateString('th-TH'),
            price: diesel.PriceToday,
            history: [],
            source: 'bangchak-api',
            oilName: diesel.OilName,
          });
        }
      }
    }

    // Fallback
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      error: 'Could not find diesel price in response',
      debug: {
        xmlLength: xmlText.length,
        entriesFound: oilEntries.length,
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
