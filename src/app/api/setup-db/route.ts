import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * POST /api/setup-db
 *
 * One-time setup endpoint to push schema and seed data.
 * Requires admin API key.
 *
 * Query params:
 *   ?action=seed  — seed settings only (default)
 *   ?action=push  — push schema + seed (full setup)
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

  const action = request.nextUrl.searchParams.get('action') || 'seed';

  try {
    // Test database connection
    const db = getDb();
    await db.$queryRaw`SELECT 1`;

    if (action === 'push') {
      // Full setup: create tables using raw SQL (since we can't run prisma db push remotely)
      const createTablesSQL = `
        -- Settings table
        CREATE TABLE IF NOT EXISTS "settings" (
          "id" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "settings_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "settings_key_key" UNIQUE ("key")
        );

        -- Routes table
        CREATE TABLE IF NOT EXISTS "routes" (
          "id" TEXT NOT NULL,
          "originName" TEXT NOT NULL,
          "originLat" DOUBLE PRECISION,
          "originLng" DOUBLE PRECISION,
          "destinationName" TEXT NOT NULL,
          "destinationLat" DOUBLE PRECISION,
          "destinationLng" DOUBLE PRECISION,
          "distance" DOUBLE PRECISION NOT NULL,
          "duration" DOUBLE PRECISION,
          "useCount" INTEGER NOT NULL DEFAULT 0,
          "isFavorite" BOOLEAN NOT NULL DEFAULT false,
          "lastUsedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX IF NOT EXISTS "routes_originName_destinationName_idx" ON "routes"("originName", "destinationName");
        CREATE INDEX IF NOT EXISTS "routes_isFavorite_idx" ON "routes"("isFavorite");
        CREATE INDEX IF NOT EXISTS "routes_useCount_idx" ON "routes"("useCount");

        -- QuotationStatus enum type
        DO $$ BEGIN
          CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        -- Quotations table
        CREATE TABLE IF NOT EXISTS "quotations" (
          "id" TEXT NOT NULL,
          "quotationNumber" TEXT NOT NULL,
          "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
          "customerName" TEXT NOT NULL,
          "customerPhone" TEXT,
          "customerEmail" TEXT,
          "customerAddress" TEXT,
          "origin" TEXT NOT NULL,
          "destination" TEXT NOT NULL,
          "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "currency" TEXT NOT NULL DEFAULT 'THB',
          "expiryDays" INTEGER NOT NULL DEFAULT 7,
          "expiryDate" TIMESTAMP(3) NOT NULL,
          "promptPayId" TEXT,
          "notes" TEXT,
          "createdBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "quotations_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "quotations_quotationNumber_key" UNIQUE ("quotationNumber")
        );
        CREATE INDEX IF NOT EXISTS "quotations_quotationNumber_idx" ON "quotations"("quotationNumber");
        CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations"("status");
        CREATE INDEX IF NOT EXISTS "quotations_createdAt_idx" ON "quotations"("createdAt");

        -- Quotation Trips table
        CREATE TABLE IF NOT EXISTS "quotation_trips" (
          "id" TEXT NOT NULL,
          "quotationId" TEXT NOT NULL,
          "tripIndex" INTEGER NOT NULL DEFAULT 0,
          "truckTypeId" TEXT NOT NULL,
          "truckName" TEXT NOT NULL,
          "truckCBM" DOUBLE PRECISION NOT NULL,
          "truckMaxWeight" DOUBLE PRECISION NOT NULL,
          "origin" TEXT,
          "destination" TEXT,
          "distance" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "dieselPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "fuelCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "tripTotalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "utilizedCBM" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "utilizationPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "totalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "quotation_trips_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX IF NOT EXISTS "quotation_trips_quotationId_idx" ON "quotation_trips"("quotationId");
        ALTER TABLE "quotation_trips" DROP CONSTRAINT IF EXISTS "quotation_trips_quotationId_fkey";
        ALTER TABLE "quotation_trips" ADD CONSTRAINT "quotation_trips_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

        -- Quotation Items table
        CREATE TABLE IF NOT EXISTS "quotation_items" (
          "id" TEXT NOT NULL,
          "tripId" TEXT NOT NULL,
          "itemIndex" INTEGER NOT NULL DEFAULT 0,
          "name" TEXT,
          "width" DOUBLE PRECISION NOT NULL,
          "length" DOUBLE PRECISION NOT NULL,
          "height" DOUBLE PRECISION NOT NULL,
          "quantity" INTEGER NOT NULL DEFAULT 1,
          "weight" DOUBLE PRECISION NOT NULL,
          "posX" DOUBLE PRECISION,
          "posY" DOUBLE PRECISION,
          "posZ" DOUBLE PRECISION,
          "rotatedW" DOUBLE PRECISION,
          "rotatedL" DOUBLE PRECISION,
          "rotatedH" DOUBLE PRECISION,
          "fits" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX IF NOT EXISTS "quotation_items_tripId_idx" ON "quotation_items"("tripId");
        ALTER TABLE "quotation_items" DROP CONSTRAINT IF EXISTS "quotation_items_tripId_fkey";
        ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "quotation_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;

      await db.$executeRawUnsafe(createTablesSQL);
    }

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

    // Get table counts after setup
    const settingsCount = await db.setting.count();
    const routesCount = await db.route.count();
    const quotationsCount = await db.quotation.count();

    return NextResponse.json({
      success: true,
      message: action === 'push' ? 'Database schema created and seeded' : 'Settings seeded',
      database: 'connected',
      action,
      seededSettings: seededSettings.length > 0 ? seededSettings : 'all settings already exist',
      tables: {
        settings: settingsCount,
        routes: routesCount,
        quotations: quotationsCount,
      },
    });
  } catch (error) {
    console.error('[setup-db] Error:', error);
    return NextResponse.json(
      {
        error: 'Database setup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        action,
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
    const db = getDb();
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
      },
      { status: 503 }
    );
  }
}
