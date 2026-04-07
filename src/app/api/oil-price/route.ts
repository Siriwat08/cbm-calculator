import { NextResponse } from 'next/server';

const FALLBACK_PRICE = 50.54;

// PTT SOAP API URL
const PTT_SOAP_URL = 'https://orapiweb.pttor.com/oilservice/OilPrice.asmx';

async function fetchFromPTT(language: string = 'th'): Promise<{ date: string; price: number } | null> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CurrentOilPrice xmlns="http://www.pttor.com">
      <Language>${language}</Language>
    </CurrentOilPrice>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(PTT_SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'https://orapiweb.pttor.com/CurrentOilPrice',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      console.log('PTT SOAP status:', response.status);
      return null;
    }

    const xmlText = await response.text();
    
    // Extract JSON from SOAP response
    const resultMatch = xmlText.match(/<CurrentOilPriceResult[^>]*>([\s\S]*?)<\/CurrentOilPriceResult>/);
    
    if (!resultMatch) {
      console.log('No CurrentOilPriceResult found');
      return null;
    }

    // Decode XML entities
    let jsonStr = resultMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();

    const oilData = JSON.parse(jsonStr);
    
    // Find diesel
    if (Array.isArray(oilData)) {
      const diesel = oilData.find((item: { PRODUCT?: string; OilName?: string }) => 
        item.PRODUCT?.includes('ดีเซล') || item.OilName?.includes('ดีเซล')
      );
      
      if (diesel) {
        return {
          date: diesel.PRICE_DATE || diesel.OilPriceDate || new Date().toLocaleDateString('th-TH'),
          price: parseFloat(diesel.PRICE || diesel.PriceToday || 0),
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('PTT SOAP error:', error);
    return null;
  }
}

// Get historical oil price
async function fetchHistoryFromPTT(days: number = 5): Promise<{ date: string; price: number }[]> {
  const history: { date: string; price: number }[] = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const dd = date.getDate();
    const mm = date.getMonth() + 1;
    const yyyy = date.getFullYear();
    
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetOilPrice xmlns="http://www.pttor.com">
      <Language>th</Language>
      <DD>${dd}</DD>
      <MM>${mm}</MM>
      <YYYY>${yyyy}</YYYY>
    </GetOilPrice>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await fetch(PTT_SOAP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'https://orapiweb.pttor.com/GetOilPrice',
        },
        body: soapEnvelope,
      });

      if (response.ok) {
        const xmlText = await response.text();
        const resultMatch = xmlText.match(/<GetOilPriceResult[^>]*>([\s\S]*?)<\/GetOilPriceResult>/);
        
        if (resultMatch) {
          let jsonStr = resultMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();

          const oilData = JSON.parse(jsonStr);
          
          if (Array.isArray(oilData)) {
            const diesel = oilData.find((item: { PRODUCT?: string }) => 
              item.PRODUCT?.includes('ดีเซล')
            );
            
            if (diesel && diesel.PRICE) {
              history.push({
                date: `${dd}/${mm}/${yyyy}`,
                price: parseFloat(diesel.PRICE),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching ${dd}/${mm}/${yyyy}:`, error);
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return history;
}

export async function GET() {
  try {
    // Try Bangchak API first (faster)
    const bangchakUrl = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
    
    const bangchakResponse = await fetch(bangchakUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (bangchakResponse.ok) {
      const data = await bangchakResponse.json();
      const oilData = Array.isArray(data) ? data[0] : data;
      const oilList = typeof oilData.OilList === 'string' 
        ? JSON.parse(oilData.OilList) 
        : oilData.OilList;
      
      const diesel = oilList.find((oil: { OilName: string }) => 
        oil.OilName === 'ไฮดีเซล S'
      );
      
      if (diesel) {
        // Fetch history from PTT (in background)
        const history = await fetchHistoryFromPTT(5);
        
        return NextResponse.json({
          date: oilData.OilPriceDate,
          price: diesel.PriceToday,
          priceYesterday: diesel.PriceYesterday,
          priceTomorrow: diesel.PriceTomorrow,
          remark: oilData.OilRemark2,
          history: history,
          source: 'bangchak-api',
        });
      }
    }

    // Fallback to PTT SOAP API
    const pttResult = await fetchFromPTT('th');
    
    if (pttResult) {
      const history = await fetchHistoryFromPTT(5);
      
      return NextResponse.json({
        date: pttResult.date,
        price: pttResult.price,
        history: history,
        source: 'ptt-soap-api',
      });
    }

    // Final fallback
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
    });

  } catch (error) {
    console.error('Oil price API error:', error);
    
    return NextResponse.json({
      date: new Date().toLocaleDateString('th-TH'),
      price: FALLBACK_PRICE,
      history: [],
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
