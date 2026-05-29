/**
 * Shared Oil Price API Utilities
 *
 * This module contains all the shared logic used by both:
 * - src/app/api/oil-price/route.ts (CRUD API)
 * - src/app/api/cron/route.ts (Cron job)
 *
 * Previously these two files had ~80% code duplication.
 * Now they import from this single source of truth.
 */

import { NextRequest } from 'next/server';
import { getTodayISO, convertThaiDateToISO } from './date-utils';

// ===== Constants =====
export const HISTORY_KEY = 'oil-price-history';
export const LEGACY_KEY = 'oil-price'; // Old single-value key
export const GREETING_KEY = 'greeting'; // Legacy test key to clean up
export const FALLBACK_DIESEL_PRICE = 42.25; // Thai diesel price as of May 2026 (บาท/ลิตร)
export const MAX_HISTORY_ENTRIES = 90;
export const MAX_OIL_PRICE = 200; // Maximum allowed oil price in THB
export const LABOR_COST = 500; // Labor cost per trip in THB

// ===== Validation Constants =====
export const CARGO_LIMITS = {
  MAX_DIMENSION_CM: 2000,
  MAX_WEIGHT_KG: 50000,
  MAX_QUANTITY: 1000,
} as const;

// ===== Oil Price Entry Type =====
export interface OilPriceEntry {
  date: string;   // ISO format: YYYY-MM-DD
  price: number;
  manual?: boolean;
}

// ===== API Key Auth =====
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    new URL(request.url).searchParams.get('apiKey');

  // Allow if ADMIN_API_KEY env var is not set (development mode)
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return true;

  return apiKey === adminKey;
}

// Re-export date utilities for backward compatibility
export { convertThaiDateToISO, getTodayISO } from './date-utils';

// ===== Normalize any Edge Config data into a proper history array =====
export function normalizeToHistoryArray(raw: unknown): OilPriceEntry[] {
  // 1. Null/undefined/empty → empty array
  if (raw === null || raw === undefined) return [];

  // 2. Already a valid array
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is OilPriceEntry =>
        item != null && typeof item === 'object' && typeof item.price === 'number'
    );
  }

  // 3. Single number (legacy format: just stored 50.54)
  if (typeof raw === 'number') {
    return [{ date: getTodayISO(), price: raw }];
  }

  // 4. Single object (legacy format: {date, price})
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.price === 'number') {
      const dateStr = typeof obj.date === 'string' ? obj.date : getTodayISO();
      return [{ date: convertThaiDateToISO(dateStr), price: obj.price, manual: obj.manual === true }];
    }
  }

  // 5. String that might be a number
  if (typeof raw === 'string') {
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      return [{ date: getTodayISO(), price: num }];
    }
  }

  // 6. Unknown format → empty array
  console.warn('Unknown Edge Config data format:', typeof raw, raw);
  return [];
}

// ===== Edge Config Read =====
export async function getFromEdgeConfig<T>(key: string): Promise<T | null> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;

  if (!edgeConfigId || !apiToken) {
    console.warn('Missing EDGE_CONFIG_ID or VERCEL_API_TOKEN env vars');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${key}`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.warn(`Edge Config read failed for key "${key}": ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.error('Edge Config read error:', error);
    return null;
  }
}

// ===== Edge Config Write =====
export async function setToEdgeConfig(key: string, value: unknown): Promise<boolean> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;

  if (!edgeConfigId || !apiToken) {
    console.error('Missing EDGE_CONFIG_ID or VERCEL_API_TOKEN');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ operation: 'upsert', key, value }],
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Edge Config save failed:', response.status, errorBody);
    }

    return response.ok;
  } catch (error) {
    console.error('Edge Config save error:', error);
    return false;
  }
}

// ===== Bangchak API =====
export async function fetchFromBangchak(): Promise<{ date: string; price: number } | null> {
  try {
    const url = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      next: { revalidate: 0 },
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
      // Extract date from remark
      const remarkMatch = oilData.OilRemark2?.match(/วันที่\s*(\d+)\s*(\S+)\s*(\d+)/);
      let effectiveDate: string;

      if (remarkMatch) {
        const day = remarkMatch[1].padStart(2, '0');
        const thaiMonth = remarkMatch[2];

        const months: Record<string, string> = {
          'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
          'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
          'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
        };

        const month = months[thaiMonth] || '01';
        let buddhistYear = remarkMatch[3];
        // Handle 2-digit Buddhist year (e.g. "69" means 2569)
        if (buddhistYear.length <= 2) {
          buddhistYear = '25' + buddhistYear.padStart(2, '0');
        }
        // Convert Buddhist year to Christian year for ISO format
        const christianYear = parseInt(buddhistYear) - 543;
        effectiveDate = `${christianYear}-${month}-${day}`;
      } else {
        // Fallback: use today's date in ISO format
        effectiveDate = getTodayISO();
      }

      return { date: effectiveDate, price: diesel.PriceToday };
    }

    return null;
  } catch (error) {
    console.error('Bangchak API error:', error);
    return null;
  }
}

/**
 * Migrate old history entries that use Thai dates to ISO format.
 * Returns the migrated history array.
 * If any entry was converted, auto-saves back to Edge Config.
 */
export async function migrateHistoryDates(history: OilPriceEntry[]): Promise<OilPriceEntry[]> {
  if (!Array.isArray(history) || history.length === 0) return history;

  let needsSave = false;

  const migrated = history.map(entry => {
    const isoDate = convertThaiDateToISO(entry.date);
    if (isoDate !== entry.date) {
      needsSave = true;
      console.log(`Migrated date: ${entry.date} → ${isoDate}`);
      return { ...entry, date: isoDate };
    }
    return entry;
  });

  if (needsSave) {
    console.log('Auto-migrating history dates to ISO format...');
    const saved = await setToEdgeConfig(HISTORY_KEY, migrated);
    if (saved) {
      console.log('Migration saved successfully');
    } else {
      console.error('Migration save failed');
    }
  }

  return migrated;
}

/**
 * Migrate legacy Edge Config key ('oil-price') to the new format ('oil-price-history').
 * Returns any history found in the legacy key.
 */
export async function migrateLegacyKey(): Promise<OilPriceEntry[] | null> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !apiToken) return null;

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${LEGACY_KEY}`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;

    const legacyData = await response.json();
    if (legacyData === null || legacyData === undefined) return null;

    console.log('Found legacy oil-price key, migrating to oil-price-history...');

    const migrated = normalizeToHistoryArray(legacyData);
    if (migrated.length > 0) {
      // Save to new key
      const saved = await setToEdgeConfig(HISTORY_KEY, migrated);
      if (saved) {
        console.log('Legacy data migrated to oil-price-history:', migrated);
        // Try to delete the old key
        try {
          await fetch(
            `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                items: [{ operation: 'delete', key: LEGACY_KEY }],
              }),
            }
          );
        } catch {
          // Ignore deletion failure
        }
      }
    }

    return migrated;
  } catch {
    return null;
  }
}

/**
 * Get oil price history from Edge Config with full defensive handling.
 * - Normalizes any data format to a proper array
 * - Migrates from legacy key if needed
 * - Migrates Thai dates to ISO
 * - Sorts by date descending
 */
export async function getOilPriceHistory(): Promise<OilPriceEntry[]> {
  // 1. Try reading from the new key
  const rawData = await getFromEdgeConfig<unknown>(HISTORY_KEY);
  let history = normalizeToHistoryArray(rawData);

  // 2. If new key is empty, try migrating from legacy key
  if (history.length === 0) {
    const legacyHistory = await migrateLegacyKey();
    if (legacyHistory && legacyHistory.length > 0) {
      history = legacyHistory;
    }
  }

  // 3. Migrate Thai dates to ISO format
  if (history.length > 0) {
    history = await migrateHistoryDates(history);
  }

  // 4. Sort by date descending
  history.sort((a, b) => b.date.localeCompare(a.date));

  return history;
}

/**
 * Auto-delete the 'greeting' legacy test key from Edge Config.
 * This key was created during initial testing and is no longer needed.
 */
export async function cleanupGreetingKey(): Promise<void> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !apiToken) return;

  try {
    // Check if greeting key exists
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${GREETING_KEY}`,
      { headers: { 'Authorization': `Bearer ${apiToken}` }, cache: 'no-store' }
    );
    if (!response.ok) return; // Key doesn't exist

    // Delete it
    await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ operation: 'delete', key: GREETING_KEY }] }),
      }
    );
    console.log('Cleaned up legacy greeting key from Edge Config');
  } catch {
    // Ignore cleanup failure
  }
}
