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
// This endpoint is triggered by:
// 1. Vercel Cron (sends vercel-cron header) — daily at 05:30 Bangkok time
// 2. Client-side auto-fetch (when today's price is missing)
// 3. Manual trigger with API key
//
// GET is safe (idempotent fetch-and-save), so we allow all access.
// No auth required — fetching oil price and saving it is not destructive.
export async function GET(request: NextRequest) {
  // Log the source of the request for debugging
  const isVercelCron = request.headers.get('vercel-cron') === 'true';
  const source = isVercelCron ? 'vercel-cron' : 'manual';
  const bangkokToday = getTodayISO();
  const utcNow = new Date().toISOString();
  console.log(`[Cron] Started — Source: ${source}, UTC: ${utcNow}, Bangkok today: ${bangkokToday}`);

  // Clean up legacy greeting key (fire and forget)
  cleanupGreetingKey().catch(() => {});

  try {
    // Try fetching from Bangchak API
    const currentPrice = await fetchFromBangchak();

    // Get existing history (with defensive handling)
    let history = await getOilPriceHistory();
    console.log(`[Cron] Existing history: ${history.length} entries`);

    // Check if today's entry already exists
    const todayEntry = history.find(h => h.date === bangkokToday);

    if (todayEntry && !currentPrice) {
      // Today's entry exists and Bangchak is down — nothing to do
      console.log(`[Cron] Today's entry exists (${todayEntry.price} บาท), Bangchak unavailable — no change needed`);
      return NextResponse.json({
        success: true,
        message: 'Today\'s price already saved, Bangchak unavailable',
        date: todayEntry.date,
        price: todayEntry.price,
        history: history,
        bangkokToday,
      });
    }

    if (!currentPrice) {
      // Bangchak API failed — create today's entry using yesterday's price (self-healing)
      if (history.length > 0) {
        const latestPrice = history[0].price;
        const newEntry = { date: bangkokToday, price: latestPrice, manual: false };

        // Check if today's entry already exists
        const existingIndex = history.findIndex(h => h.date === bangkokToday);
        if (existingIndex === -1) {
          history = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
          console.log(`[Cron] Bangchak API failed — created today's entry using latest price: ${latestPrice} บาท`);
        }

        const saved = await setToEdgeConfig(HISTORY_KEY, history);
        if (saved) {
          console.log(`[Cron] ✅ Self-healed: saved today's entry (${latestPrice} บาท) from latest history`);
          return NextResponse.json({
            success: true,
            message: 'Bangchak API unavailable, created today\'s entry using latest stored price',
            date: bangkokToday,
            price: latestPrice,
            history: history,
            bangkokToday,
          });
        }
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch oil price and no history available'
      }, { status: 500 });
    }

    console.log(`[Cron] Bangchak price: ${currentPrice.price} บาท — effective date: ${currentPrice.date} (Bangkok today: ${bangkokToday})`);

    // Use the current date from Bangchak or fall back to Bangkok today
    const entryDate = currentPrice.date || bangkokToday;
    const newEntry = { date: entryDate, price: currentPrice.price, manual: false };

    const existingIndex = history.findIndex(h => h.date === entryDate);

    if (existingIndex === -1) {
      history = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
      console.log(`[Cron] Adding new entry for ${entryDate} — total: ${history.length}`);
    } else {
      history[existingIndex] = newEntry;
      console.log(`[Cron] Updated existing entry for ${entryDate}`);
    }

    const saved = await setToEdgeConfig(HISTORY_KEY, history);

    if (saved) {
      console.log(`[Cron] ✅ Saved ${history.length} history entries to Edge Config`);

      return NextResponse.json({
        success: true,
        message: 'Oil price saved successfully',
        date: entryDate,
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
