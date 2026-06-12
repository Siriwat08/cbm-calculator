import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateQuotationNumber } from '@/lib/quotation/number-generator';

// GET: Preview next quotation number (without creating)
export async function GET() {
  try {
    const db = getDb();
    const nextNumber = await generateQuotationNumber(db);
    return NextResponse.json({ nextNumber });
  } catch (error) {
    console.error('[NextNumber] Error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงหมายเลขใบเสนอราคาได้' }, { status: 500 });
  }
}
