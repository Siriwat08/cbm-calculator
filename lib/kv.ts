import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function getOilPriceHistory() {
  try {
    const history = await redis.get<{ date: string; price: number }[]>('oil-price-history');
    return history || [];
  } catch {
    return [];
  }
}

export async function saveOilPrice(date: string, price: number) {
  try {
    const history = await getOilPriceHistory();
    const exists = history.some(h => h.date === date);
    if (exists) return history;
    
    const newHistory = [{ date, price }, ...history].slice(0, 10);
    await redis.set('oil-price-history', newHistory);
    return newHistory;
  } catch {
    return [];
  }
}

export async function setCurrentOilPrice(price: number) {
  try {
    await redis.set('current-oil-price', price);
  } catch {
    // ignore
  }
}
