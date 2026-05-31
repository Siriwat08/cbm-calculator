import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { validateApiKey } from '@/lib/oil-price-api';
import { getTodayISO } from '@/lib/date-utils';
import { generateQuotationNumber } from '@/lib/quotation/number-generator';

// ===== GET: List all quotations =====
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (status) where.status = status.toUpperCase();

    const [quotations, total] = await Promise.all([
      db.quotation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          trips: {
            orderBy: { tripIndex: 'asc' },
            include: { items: { orderBy: { itemIndex: 'asc' } } },
          },
        },
      }),
      db.quotation.count({ where }),
    ]);

    return NextResponse.json({ quotations, total });
  } catch (error) {
    console.error('[Quotations] GET error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลใบเสนอราคาได้' }, { status: 500 });
  }
}

// ===== POST: Create new quotation =====
export async function POST(request: NextRequest) {
  // Auth check
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ — กรุณาระบุ API Key' }, { status: 401 });
  }

  try {
    const db = getDb();
    const body = await request.json();

    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      origin,
      destination,
      expiryDays = 7,
      notes,
      createdBy,
      trips = [],
    } = body;

    // Validate required fields
    if (!customerName?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อลูกค้า' }, { status: 400 });
    }
    if (!origin?.trim() || !destination?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุต้นทางและปลายทาง' }, { status: 400 });
    }

    // Generate quotation number
    const quotationNumber = await generateQuotationNumber(db);

    // Calculate expiry date
    const today = new Date();
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    // Calculate total price from trips
    const totalPrice = trips.reduce((sum: number, trip: { tripTotalPrice?: number }) => {
      return sum + (trip.tripTotalPrice || 0);
    }, 0);

    // Create quotation with trips and items
    const quotation = await db.quotation.create({
      data: {
        quotationNumber,
        status: 'DRAFT',
        customerName: customerName.trim(),
        customerPhone: customerPhone?.trim() || null,
        customerEmail: customerEmail?.trim() || null,
        customerAddress: customerAddress?.trim() || null,
        origin: origin.trim(),
        destination: destination.trim(),
        totalPrice,
        expiryDays,
        expiryDate,
        notes: notes?.trim() || null,
        createdBy: createdBy?.trim() || null,
        trips: {
          create: trips.map((trip: Record<string, unknown>, index: number) => ({
            tripIndex: index,
            truckTypeId: String(trip.truckTypeId || ''),
            truckName: String(trip.truckName || ''),
            truckCBM: Number(trip.truckCBM || 0),
            truckMaxWeight: Number(trip.truckMaxWeight || 0),
            origin: String(trip.origin || origin),
            destination: String(trip.destination || destination),
            distance: Number(trip.distance || 0),
            dieselPrice: Number(trip.dieselPrice || 0),
            fuelCost: Number(trip.fuelCost || 0),
            laborCost: Number(trip.laborCost || 0),
            basePrice: Number(trip.basePrice || 0),
            tripTotalPrice: Number(trip.tripTotalPrice || 0),
            utilizedCBM: Number(trip.utilizedCBM || 0),
            utilizationPct: Number(trip.utilizationPct || 0),
            totalWeight: Number(trip.totalWeight || 0),
            items: {
              create: Array.isArray(trip.items)
                ? trip.items.map((item: Record<string, unknown>, itemIndex: number) => ({
                    itemIndex,
                    name: String(item.name || ''),
                    width: Number(item.width || 0),
                    length: Number(item.length || 0),
                    height: Number(item.height || 0),
                    quantity: Number(item.quantity || 1),
                    weight: Number(item.weight || 0),
                  }))
                : [],
            },
          })),
        },
      },
      include: {
        trips: {
          orderBy: { tripIndex: 'asc' },
          include: { items: { orderBy: { itemIndex: 'asc' } } },
        },
      },
    });

    console.log(`[Quotations] Created ${quotationNumber} — total: ${totalPrice} บาท`);

    return NextResponse.json({ success: true, quotation }, { status: 201 });
  } catch (error) {
    console.error('[Quotations] POST error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างใบเสนอราคาได้' }, { status: 500 });
  }
}
