import { NextRequest, NextResponse } from 'next/server';
import {
  validateApiKey,
  getOilPriceHistory,
  setToEdgeConfig,
  fetchFromBangchak,
  cleanupGreetingKey,
  getTodayISO,
  HISTORY_KEY,
  MAX_HISTORY_ENTRIES,
} from '@/lib/oil-price-api';

// ===== CRON HANDLER =====
export async function GET(request: NextRequest) {
  // Auth check for manual cron triggers (Vercel cron sends vercel-cron header)
  const isVercelCron = request.headers.get('vercel-cron') === 'true';
  if (!isVercelCron && !validateApiKey(request)) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาระบุ API Key' },
      { status: 401 }
    );
  }

  const bangkokToday = getTodayISO();
  const utcNow = new Date().toISOString();
  console.log(`[Cron] Started — UTC: ${utcNow}, Bangkok today: ${bangkokToday}`);

  // Clean up legacy greeting key (fire and forget)
  cleanupGreetingKey().catch(() => {});

  try {
    const currentPrice = await fetchFromBangchak();

    // Get existing history (with defensive handling)
    let history = await getOilPriceHistory();
    console.log(`[Cron] Existing history: ${history.length} entries`);

    if (!currentPrice) {
      // If Bangchak API fails, try to use latest history price
      if (history.length > 0) {
        console.log('[Cron] Bangchak API failed, keeping latest history price');
        return NextResponse.json({
          success: true,
          message: 'Bangchak API unavailable, kept latest stored price',
          date: history[0].date,
          price: history[0].price,
          history: history,
          bangkokToday,
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch oil price and no history available'
      }, { status: 500 });
    }

    console.log(`[Cron] Bangchak price: ${currentPrice.price} บาท — effective date: ${currentPrice.date} (Bangkok today: ${bangkokToday})`);

    const existingIndex = history.findIndex(h => h.date === currentPrice.date);

    if (existingIndex === -1) {
      history = [currentPrice, ...history].slice(0, MAX_HISTORY_ENTRIES);
      console.log(`[Cron] Adding new entry for ${currentPrice.date} — total: ${history.length}`);
    } else {
      history[existingIndex] = currentPrice;
      console.log(`[Cron] Updated existing entry for ${currentPrice.date}`);
    }

    const saved = await setToEdgeConfig(HISTORY_KEY, history);

    if (saved) {
      console.log(`[Cron] ✅ Saved ${history.length} history entries to Edge Config`);

      return NextResponse.json({
        success: true,
        message: 'Oil price saved successfully',
        date: currentPrice.date,
        price: currentPrice.price,
        history: history,
        bangkokToday,
      });
    } else {
      console.error('[Cron] ❌ Failed to save to Edge Config');
      return NextResponse.json({
        success: false,
        error: 'Failed to save to Edge Config',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal error'
    }, { status: 500 });
  }
}
