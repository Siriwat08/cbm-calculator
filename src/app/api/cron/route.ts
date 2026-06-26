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
import type { OilPriceEntry } from '@/lib/oil-price-api';

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

/**
 * Ensure history has an entry for the given date with the given price.
 * - If the date already exists, the entry is updated in place.
 * - If not, a new entry is inserted at the top.
 * Returns the updated history (already trimmed to MAX_HISTORY_ENTRIES).
 */
function upsertEntryForDate(history: OilPriceEntry[], date: string, price: number): OilPriceEntry[] {
  const entry: OilPriceEntry = { date, price };
  const idx = history.findIndex(h => h.date === date);
  if (idx === -1) {
    return [entry, ...history].slice(0, MAX_HISTORY_ENTRIES);
  }
  const updated = [...history];
  updated[idx] = entry;
  return updated;
}

/**
 * Handle the case where Bangchak API is unavailable.
 * Falls back to the latest stored price for today's entry.
 * Returns a NextResponse (success or 500), or null if no fallback is possible.
 */
async function handleBangchakUnavailable(
  history: OilPriceEntry[],
  bangkokToday: string
): Promise<NextResponse | null> {
  if (history.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch oil price and no history available' },
      { status: 500 }
    );
  }

  const latestPrice = history[0].price;
  console.log(`[Cron] Bangchak API failed, using latest stored price: ${latestPrice}`);

  const updatedHistory = upsertEntryForDate(history, bangkokToday, latestPrice);
  console.log(`[Cron] Upserted today's entry for ${bangkokToday} with fallback price ${latestPrice}`);

  const saved = await setToEdgeConfig(HISTORY_KEY, updatedHistory);
  if (saved) {
    console.log(`[Cron] ✅ Saved ${updatedHistory.length} history entries (Bangchak fallback)`);
  }

  return NextResponse.json({
    success: true,
    message: 'Bangchak API unavailable, used latest stored price for today',
    date: bangkokToday,
    price: latestPrice,
    history: updatedHistory,
    bangkokToday,
  });
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
    const history = await getOilPriceHistory();
    console.log(`[Cron] Existing history: ${history.length} entries`);

    // If Bangchak API fails, fall back to the latest stored price for today.
    if (!currentPrice) {
      return (await handleBangchakUnavailable(history, bangkokToday)) as NextResponse;
    }

    console.log(`[Cron] Bangchak price: ${currentPrice.price} บาท — effective date: ${currentPrice.date} (Bangkok today: ${bangkokToday})`);

    // IMPORTANT: Always ensure we have an entry for today's date.
    // Bangchak reports the date when price was last CHANGED,
    // but if price hasn't changed today, that date stays stale (e.g. 30/05).
    // We create/update an entry for today so the UI always shows the current date.
    let updatedHistory = upsertEntryForDate(history, bangkokToday, currentPrice.price);
    console.log(`[Cron] Upserted today's entry for ${bangkokToday}`);

    // Also preserve the Bangchak effective date entry if it's different from today
    // (This keeps the historical record of when the price actually changed)
    if (currentPrice.date !== bangkokToday) {
      const effectiveIndex = updatedHistory.findIndex(h => h.date === currentPrice.date);
      if (effectiveIndex === -1) {
        updatedHistory.push(currentPrice);
        updatedHistory.sort((a, b) => b.date.localeCompare(a.date));
        updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);
        console.log(`[Cron] Also preserved Bangchak effective date entry for ${currentPrice.date}`);
      }
    }

    const saved = await setToEdgeConfig(HISTORY_KEY, updatedHistory);

    if (!saved) {
      console.error('[Cron] ❌ Failed to save to Edge Config');
      return NextResponse.json(
        { success: false, error: 'Failed to save to Edge Config' },
        { status: 500 }
      );
    }

    console.log(`[Cron] ✅ Saved ${updatedHistory.length} history entries to Edge Config`);
    return NextResponse.json({
      success: true,
      message: 'Oil price saved successfully',
      date: bangkokToday,
      price: currentPrice.price,
      history: updatedHistory,
      bangkokToday,
    });

  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal error'
    }, { status: 500 });
  }
}
