import { NextResponse } from 'next/server';

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

    const response = await fetch('https://orapiweb.pttor.com/oilservice/OilPrice.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'https://orapiweb.pttor.com/CurrentOilPrice',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML response to extract oil price data
    // The response contains CurrentOilPriceResult which is a JSON string
    const resultMatch = xmlText.match(/<CurrentOilPriceResult[^>]*>([\s\S]*?)<\/CurrentOilPriceResult>/);
    
    if (!resultMatch) {
      throw new Error('Could not parse oil price result');
    }

    // Decode XML entities and parse JSON
    let jsonStr = resultMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // Parse the JSON data
    const oilData = JSON.parse(jsonStr);
    
    // Find Hi-Diesel S (ไฮดีเซล)
    // The data structure might be an array of oil products
    let diesel = null;
    
    if (Array.isArray(oilData)) {
      diesel = oilData.find((item: { OilName?: string; PRODUCT?: string }) => 
        item.OilName?.includes('ดีเซล') || 
        item.PRODUCT?.includes('ดีเซล')
      );
    } else if (oilData.OilList) {
      diesel = oilData.OilList.find((item: { OilName?: string }) => 
        item.OilName?.includes('ดีเซล')
      );
    }

    // If we found diesel data
    if (diesel) {
      const price = diesel.PriceToday || diesel.PRICE || diesel.price || 0;
      const date = diesel.OilPriceDate || diesel.PRICE_DATE || new Date().toLocaleDateString('th-TH');
      
      return NextResponse.json({
        date: date,
        price: parseFloat(price),
        rawData: diesel,
      });
    }

    // If structure is different, try to extract from the raw data
    // PTT API returns data in format: {PRICE_DATE, PRODUCT, PRICE, ...}
    if (Array.isArray(oilData)) {
      const dieselProduct = oilData.find((item: { PRODUCT?: string }) => 
        item.PRODUCT?.includes('ดีเซล') || item.PRODUCT?.includes('Diesel')
      );
      
      if (dieselProduct) {
        return NextResponse.json({
          date: dieselProduct.PRICE_DATE || dieselProduct.UpdateDate || new Date().toLocaleDateString('th-TH'),
          price: parseFloat(dieselProduct.PRICE || dieselProduct.Price || 0),
          rawData: dieselProduct,
        });
      }
    }

    // Return the raw data for debugging
    return NextResponse.json({
      error: 'Could not find diesel price in response',
      rawResponse: oilData,
    });

  } catch (error) {
    console.error('PTT Oil Price API Error:', error);
    
    // Fallback: Try the simpler HTTP endpoint
    try {
      const fallbackResponse = await fetch('https://www.pttor.com/oil_price_board?lang=th');
      const htmlText = await fallbackResponse.text();
      
      // Try to extract price from HTML (basic scraping as last resort)
      // This is not ideal but serves as fallback
      return NextResponse.json({
        error: 'SOAP API failed, HTML scraping not implemented',
        message: 'Please check PTT API availability',
      });
    } catch {
      return NextResponse.json({ 
        error: 'Failed to fetch oil price from all sources',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
}
