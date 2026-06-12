/**
 * Quotation Number Generator
 *
 * Format: QT-{YEAR}-{NUMBER}
 * Example: QT-2026-0001, QT-2026-0002, ...
 *
 * Uses the database to get the next sequential number for the current year.
 * Thread-safe via database transaction.
 */

import { PrismaClient } from '@prisma/client';

export async function generateQuotationNumber(db: PrismaClient): Promise<string> {
  const currentYear = new Date().getFullYear(); // e.g. 2026

  // Find the latest quotation number for this year
  const prefix = `QT-${currentYear}-`;

  const latestQuotation = await db.quotation.findFirst({
    where: {
      quotationNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      quotationNumber: 'desc',
    },
    select: {
      quotationNumber: true,
    },
  });

  let nextNumber = 1;

  if (latestQuotation) {
    // Extract the number part from "QT-2026-0001"
    const parts = latestQuotation.quotationNumber.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  // Format with zero-padding (4 digits)
  const formattedNumber = String(nextNumber).padStart(4, '0');
  return `${prefix}${formattedNumber}`;
}
