import { NextResponse } from 'next/server';
import { getOilPriceHistory, saveOilPrice, setCurrentOilPrice } from '@/lib/kv';

export async function GET() {
  try {
    // PTT SOAP API
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CurrentOilPrice xmlns="http://www.pttor.com">
      <Language>th</Language>
    </CurrentOilPrice>
  </soap:Body>
</soap:Envelope>`;

    let oilPrice = null;
    let oilDate = null;
    
    try {
      const response = await fetch('https://orapiweb.pttor.com/oilservice/OilPrice.asmx', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'https://orapiweb.pttor.com/CurrentOilPrice',
        },
        body: soapEnvelope,
      });

      if (response.ok) {
        const xmlText = await response.text();
        const resultMatch = xmlText.match(/<CurrentOilPriceResult[^>]*>([\s\S]*?)<\/CurrentOilPriceResult>/);
        
        if (resultMatch) {
          let jsonStr = resultMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();

          const oilData = JSON.parse(jsonStr);
          
          let diesel = null;
          if (Array.isArray(oilData)) {
            diesel = oilData.find((item: { PRODUCT?: string }) => 
              item.PRODUCT?.includes('ดีเซล') || item.PRODUCT?.includes('Diesel')
            );
          }

          if (diesel) {
            oilPrice = parseFloat(diesel.PRICE || diesel.Price || 0);
            oilDate = diesel.PRICE_DATE || diesel.UpdateDate || new Date().toLocaleDateString('th-TH');
          }
        }
      }
    } catch (apiError) {
      console.error('PTT API Error:', apiError);
    }

    // Get history from KV
    const history = await getOilPriceHistory();
    
    // If we got new price from API, save it
    if (oilPrice && oilDate) {
      await setCurrentOilPrice(oilPrice);
      const newHistory = await saveOilPrice(oilDate, oilPrice);
      
      return NextResponse.json({
        date: oilDate,
        price: oilPrice,
        history: newHistory,
        source: 'ptt-api',
      });
    }
    
    // If API failed, return history from KV
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
      error: 'Could not fetch oil price',
      history: [],
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
