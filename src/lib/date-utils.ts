/**
 * Date Utilities - Standardized date handling
 *
 * Storage format: ISO YYYY-MM-DD
 * Display format: Thai Buddhist calendar DD/MM/BBBB (e.g. 28/05/2569)
 */

const THAI_MONTHS: Record<string, string> = {
  '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
  '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
  '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.',
};

// Convert ISO date to Thai display format
export function formatThaiDate(isoDate: string): string {
  if (!isoDate) return '';

  // Already in DD/MM/YYYY format
  if (isoDate.includes('/') && isoDate.split('/').length === 3) {
    const parts = isoDate.split('/');
    // If the year is already Buddhist era (5 digits or > 2400)
    if (parseInt(parts[2]) > 2400) {
      return isoDate;
    }
    // Convert Christian to Buddhist era
    return `${parts[0]}/${parts[1]}/${parseInt(parts[2]) + 543}`;
  }

  // ISO format: YYYY-MM-DD
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const buddhistYear = parseInt(year) + 543;
    return `${day}/${month}/${buddhistYear}`;
  }

  return isoDate;
}

// Convert Thai date (DD/MM/BBBB) to ISO (YYYY-MM-DD)
export function thaiDateToISO(thaiDate: string): string {
  if (!thaiDate) return '';

  // Already ISO format
  if (thaiDate.includes('-') && thaiDate.split('-').length === 3) {
    return thaiDate;
  }

  const parts = thaiDate.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const christianYear = parseInt(year) - 543;
    return `${christianYear}-${month}-${day}`;
  }

  return thaiDate;
}

// Get today's date in ISO format
export function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today's date in Thai format
export function getTodayThai(): string {
  const today = new Date();
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const year = (today.getFullYear() + 543).toString();
  return `${day}/${month}/${year}`;
}

// Get Thai month name
export function getThaiMonth(month: string): string {
  return THAI_MONTHS[month] || month;
}

// Format Thai date with month name
export function formatThaiDateLong(isoDate: string): string {
  if (!isoDate) return '';

  let day: string, month: string, year: string;

  if (isoDate.includes('-')) {
    const parts = isoDate.split('-');
    year = (parseInt(parts[0]) + 543).toString();
    month = parts[1];
    day = parseInt(parts[2]).toString();
  } else if (isoDate.includes('/')) {
    const parts = isoDate.split('/');
    day = parseInt(parts[0]).toString();
    month = parts[1];
    year = parts[2];
    if (parseInt(year) < 2400) year = (parseInt(year) + 543).toString();
  } else {
    return isoDate;
  }

  return `${day} ${getThaiMonth(month)} ${year}`;
}
