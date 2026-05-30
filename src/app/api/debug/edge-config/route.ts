import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Only allow with API key
  const apiKey = request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    new URL(request.url).searchParams.get('apiKey');

  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && apiKey !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    envVars: {
      EDGE_CONFIG_ID: edgeConfigId ? `${edgeConfigId.slice(0, 4)}...${edgeConfigId.slice(-4)}` : 'NOT SET',
      VERCEL_API_TOKEN: apiToken ? `${apiToken.slice(0, 4)}...${apiToken.slice(-4)}` : 'NOT SET',
      ADMIN_API_KEY: adminKey ? 'SET' : 'NOT SET',
    },
  };

  if (!edgeConfigId || !apiToken) {
    diagnostics.error = 'Missing required environment variables';
    return NextResponse.json(diagnostics, { status: 500 });
  }

  try {
    // 1. Read all items from Edge Config (list endpoint)
    const listResponse = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        cache: 'no-store',
      }
    );

    diagnostics.listStatus = listResponse.status;
    diagnostics.listStatusText = listResponse.statusText;

    if (listResponse.ok) {
      const listData = await listResponse.json();
      diagnostics.allItems = listData;
      diagnostics.itemCount = Array.isArray(listData) ? listData.length : 'not-array';
    } else {
      const errorBody = await listResponse.text();
      diagnostics.listError = errorBody;
    }
  } catch (error) {
    diagnostics.listFetchError = error instanceof Error ? error.message : String(error);
  }

  try {
    // 2. Read specific key: oil-price-history
    const readResponse = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/oil-price-history`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        cache: 'no-store',
      }
    );

    diagnostics.readStatus = readResponse.status;
    diagnostics.readStatusText = readResponse.statusText;

    if (readResponse.ok) {
      const readData = await readResponse.json();
      diagnostics.oilPriceHistoryRaw = readData;
      diagnostics.oilPriceHistoryType = typeof readData;
      diagnostics.oilPriceHistoryLength = Array.isArray(readData) ? readData.length : 'not-array';
    } else {
      const errorBody = await readResponse.text();
      diagnostics.readError = errorBody;
    }
  } catch (error) {
    diagnostics.readFetchError = error instanceof Error ? error.message : String(error);
  }

  try {
    // 3. Read legacy key: oil-price
    const legacyResponse = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/oil-price`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        cache: 'no-store',
      }
    );

    diagnostics.legacyStatus = legacyResponse.status;

    if (legacyResponse.ok) {
      const legacyData = await legacyResponse.json();
      diagnostics.legacyOilPrice = legacyData;
    }
  } catch (error) {
    diagnostics.legacyFetchError = error instanceof Error ? error.message : String(error);
  }

  try {
    // 4. Test write: save a test value
    const testWrite = {
      items: [{
        operation: 'upsert',
        key: 'oil-price-history',
        value: [{ date: new Date().toISOString().split('T')[0], price: 999.99, test: true }],
      }],
    };

    const writeResponse = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testWrite),
      }
    );

    diagnostics.writeStatus = writeResponse.status;
    diagnostics.writeStatusText = writeResponse.statusText;
    diagnostics.writeOk = writeResponse.ok;

    const writeBody = await writeResponse.text();
    diagnostics.writeResponseRaw = writeBody;

    // 5. Immediately read back to verify
    if (writeResponse.ok) {
      // Wait a moment for Edge Config to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      const verifyResponse = await fetch(
        `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/oil-price-history`,
        {
          headers: { 'Authorization': `Bearer ${apiToken}` },
          cache: 'no-store',
        }
      );

      diagnostics.verifyStatus = verifyResponse.status;

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        diagnostics.verifyData = verifyData;
      } else {
        diagnostics.verifyError = await verifyResponse.text();
      }
    }
  } catch (error) {
    diagnostics.writeFetchError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
