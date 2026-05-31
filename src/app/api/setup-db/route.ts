import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/setup-db
 *
 * One-time setup endpoint to push schema and seed data.
 * Requires admin API key.
 * Call once after deployment with a fresh database.
 */
export async function POST(request: NextRequest) {
  // Auth check
  const apiKey = request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.nextUrl.searchParams.get('apiKey');

  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && apiKey !== adminKey) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาระบุ API Key' },
      { status: 401 }
    );
  }

  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`;

    // Seed settings if they don't exist
    const settings = [
      { key: 'company_name', value: 'หจก.เผ่าปัญญา ทรานสปอร์ต' },
      { key: 'company_phone', value: '089-999-9999' },
      { key: 'company_address', value: 'กรุงเทพมหานคร' },
      { key: 'promptpay_id', value: '0899999999' },
      { key: 'quotation_prefix', value: 'QT' },
      { key: 'quotation_start_number', value: '1' },
      { key: 'oil_reference_name', value: 'ปตท.' },
    ];

    const seededSettings: string[] = [];

    for (const setting of settings) {
      const existing = await db.setting.findUnique({ where: { key: setting.key } });
      if (!existing) {
        await db.setting.create({ data: { key: setting.key, value: setting.value } });
        seededSettings.push(setting.key);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database setup complete',
      database: 'connected',
      seededSettings: seededSettings.length > 0 ? seededSettings : 'all settings already exist',
    });
  } catch (error) {
    console.error('[setup-db] Error:', error);
    return NextResponse.json(
      {
        error: 'Database setup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure you ran `prisma db push` to create tables first, or check DATABASE_URL',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/setup-db
 *
 * Health check - verify database connectivity without modifying anything.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;

    const settingsCount = await db.setting.count();
    const routesCount = await db.route.count();
    const quotationsCount = await db.quotation.count();

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      tables: {
        settings: settingsCount,
        routes: routesCount,
        quotations: quotationsCount,
      },
    });
  } catch (error) {
    console.error('[setup-db/health] Error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Run `prisma db push` to create tables, then POST /api/setup-db to seed data',
      },
      { status: 503 }
    );
  }
}
