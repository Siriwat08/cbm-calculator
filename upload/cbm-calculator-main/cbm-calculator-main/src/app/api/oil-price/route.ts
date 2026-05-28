+++ src/app/api/oil-price/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { get, set } from '@vercel/edge-config';

const FALLBACK_PRICE = 50.54;
const HISTORY_KEY = 'oil-price-history';

// ===== BANGCHAK API =====
async function fetchFromBangchak(): Promise<{ date: string; price: number } | null> {
  try {
    const url = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const data = await response.json();
    const oilData = Array.isArray(data) ? data[0] : data;
    const oilList = typeof oilData.OilList === 'string'
      ? JSON.parse(oilData.OilList)
      : oilData.OilList;

    const diesel = oilList.find((oil: { OilName: string }) =>
      oil.OilName === 'ไฮดีเซล S'
    );

    if (diesel) {
      const remarkMatch = oilData.OilRemark2?.match(/วันที่\s*(\d+)\s*(\S+)\s*(\d+)/);
      let effectiveDate = oilData.OilPriceDate;

      if (remarkMatch) {
        const day = remarkMatch[1].padStart(2, '0');
        const thaiMonth = remarkMatch[2];

        const months: { [key: string]: string } = {
          'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
          'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
          'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
        };

        const month = months[thaiMonth] || '01';
        const year = remarkMatch[3];
        effectiveDate = `${day}/${month}/${year}`;
      }

      return { date: effectiveDate, price: diesel.PriceToday };
    }

    return null;
  } catch (error) {
    console.error('Bangchak API error:', error);
    return null;
  }
}

// ===== GET CURRENT PRICE =====
export async function GET() {
  try {
    // 1. Get current price from Bangchak
    const currentPrice = await fetchFromBangchak();

    // 2. Get history from Edge Config
    const history = await get<{ date: string; price: number }[]>(HISTORY_KEY) || [];

    // 3. Return response
    if (history.length > 0) {
      return NextResponse.json({
        date: history[0].date,
        price: history[0].price,
        history: history,
        source: 'edge-config',
      });
    }

    // 4. Fallback: use current price if no history
    if (currentPrice) {
      return NextResponse.json({
        date: currentPrice.date,
        price: currentPrice.price,
        history: [currentPrice],
        source: 'bangchak-api',
      });
    }

    // 5. Final fallback
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
    });
  }
}

// ===== UPDATE/ADD OIL PRICE =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { price, date, manual = true } = body;

    // Validate input
    if (price === undefined || price === null) {
      return NextResponse.json(
        { error: 'Price is required' },
        { status: 400 }
      );
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    // Get existing history
    const history = await get<{ date: string; price: number; manual?: boolean }[]>(HISTORY_KEY) || [];

    // Use provided date or generate current date
    const priceDate = date || new Date().toLocaleDateString('th-TH');

    // Create new price entry
    const newEntry = {
      date: priceDate,
      price: numericPrice,
      manual: manual !== false // default to true for manual updates
    };

    // Check if same date exists, update it
    const existingIndex = history.findIndex(entry => entry.date === priceDate);

    if (existingIndex !== -1) {
      // Update existing entry
      history[existingIndex] = newEntry;
    } else {
      // Add new entry at the beginning
      history.unshift(newEntry);
    }

    // Save to Edge Config
    await set(HISTORY_KEY, history);

    return NextResponse.json({
      success: true,
      data: newEntry,
      message: existingIndex !== -1 ? 'Updated existing price' : 'Added new price',
    });

  } catch (error) {
    console.error('Error updating oil price:', error);
    return NextResponse.json(
      { error: 'Failed to update oil price' },
      { status: 500 }
    );
  }
}

// ===== DELETE OIL PRICE ENTRY =====
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateToDelete = searchParams.get('date');

    if (!dateToDelete) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    const history = await get<{ date: string; price: number; manual?: boolean }[]>(HISTORY_KEY) || [];
    const filteredHistory = history.filter(entry => entry.date !== dateToDelete);

    if (filteredHistory.length === history.length) {
      return NextResponse.json(
        { error: 'No entry found for the specified date' },
        { status: 404 }
      );
    }

    await set(HISTORY_KEY, filteredHistory);

    return NextResponse.json({
      success: true,
      message: 'Price entry deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting oil price:', error);
    return NextResponse.json(
      { error: 'Failed to delete oil price' },
      { status: 500 }
    );
  }
}
