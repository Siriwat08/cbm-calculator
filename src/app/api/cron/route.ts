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

// ===== AUTH HELPERS =====
function resolveAuth(request: NextRequest): {
  authorized: boolean;
  authMethod: string;
  vercelCronHeader: string | null;
} {
  // Auth check — 3 ways to authenticate:
  // 1. Vercel Cron auto-sends "vercel-cron" header (value = schedule string like "30 22 * * *")
  // 2. CRON_SECRET env var — Vercel sends Authorization: Bearer <CRON_SECRET>
  // 3. ADMIN_API_KEY — for manual triggers via API key
  const vercelCronHeader = request.headers.get('vercel-cron');
  const isVercelCron = vercelCronHeader !== null; // Vercel sets this header on cron requests (value = schedule)

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
  const isCronSecretValid = Boolean(cronSecret && authHeader === cronSecret);

  const isApiKeyValid = validateApiKey(request);

  let authMethod = 'API_KEY';
  if (isVercelCron) authMethod = 'vercel-cron';
  else if (isCronSecretValid) authMethod = 'CRON_SECRET';

  return {
    authorized: isVercelCron || isCronSecretValid || isApiKeyValid,
    authMethod,
    vercelCronHeader,
  };
}

// ===== CRON HANDLER =====
export async function GET(request: NextRequest) {
  const { authorized, authMethod, vercelCronHeader } = resolveAuth(request);

  if (!authorized) {
    console.warn('[Cron] ❌ Unauthorized request — missing vercel-cron header, CRON_SECRET, or API key');
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาระบุ API Key หรือเรียกผ่าน Vercel Cron' },
      { status: 401 }
    );
  }

  const cronSuffix = vercelCronHeader ? ` (${vercelCronHeader})` : '';
  console.log(`[Cron] ✅ Authenticated via: ${authMethod}${cronSuffix}`);

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
      // If Bangchak API fails, use latest history price for today's entry
      if (history.length > 0) {
        const latestPrice = history[0].price;
        console.log(`[Cron] Bangchak API failed, using latest stored price: ${latestPrice}`);

        // IMPORTANT: Still create/update today's entry even when Bangchak is down
        // This ensures the UI always shows today's date with the correct price
        const todayEntry = { date: bangkokToday, price: latestPrice };
        const todayIndex = history.findIndex(h => h.date === bangkokToday);
        if (todayIndex === -1) {
          history = [todayEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
          console.log(`[Cron] Added today's entry for ${bangkokToday} with fallback price ${latestPrice}`);
        } else {
          history[todayIndex] = todayEntry;
          console.log(`[Cron] Updated today's entry for ${bangkokToday} with fallback price ${latestPrice}`);
        }

        const saved = await setToEdgeConfig(HISTORY_KEY, history);
        if (saved) {
          console.log(`[Cron] ✅ Saved ${history.length} history entries (Bangchak fallback)`);
        }

        return NextResponse.json({
          success: true,
          message: 'Bangchak API unavailable, used latest stored price for today',
          date: bangkokToday,
          price: latestPrice,
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

    // IMPORTANT: Always ensure we have an entry for today's date.
    // Bangchak reports the date when price was last CHANGED,
    // but if price hasn't changed today, that date stays stale (e.g. 30/05).
    // We create/update an entry for today so the UI always shows the current date.
    const todayEntry = { date: bangkokToday, price: currentPrice.price };
    const todayIndex = history.findIndex(h => h.date === bangkokToday);
    if (todayIndex === -1) {
      // No entry for today yet → add it at the top
      history = [todayEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
      console.log(`[Cron] Adding today's entry for ${bangkokToday} — total: ${history.length}`);
    } else {
      // Update existing today entry with latest price
      history[todayIndex] = todayEntry;
      console.log(`[Cron] Updated existing today entry for ${bangkokToday}`);
    }

    // Also preserve the Bangchak effective date entry if it's different from today
    // (This keeps the historical record of when the price actually changed)
    if (currentPrice.date !== bangkokToday) {
      const effectiveIndex = history.findIndex(h => h.date === currentPrice.date);
      if (effectiveIndex === -1) {
        history.push(currentPrice);
        history.sort((a, b) => b.date.localeCompare(a.date));
        history = history.slice(0, MAX_HISTORY_ENTRIES);
        console.log(`[Cron] Also preserved Bangchak effective date entry for ${currentPrice.date}`);
      }
    }

    const saved = await setToEdgeConfig(HISTORY_KEY, history);

    if (saved) {
      console.log(`[Cron] ✅ Saved ${history.length} history entries to Edge Config`);

      return NextResponse.json({
        success: true,
        message: 'Oil price saved successfully',
        date: bangkokToday,
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
