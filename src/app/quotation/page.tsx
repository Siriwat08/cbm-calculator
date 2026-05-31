'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import QuotationPreview from '@/components/quotation/QuotationPreview';
import type { QuotationData } from '@/components/quotation/QuotationForm';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'ร่าง', color: 'text-gray-700', bgColor: 'bg-gray-200' },
  SENT: { label: 'ส่งแล้ว', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ACCEPTED: { label: 'ตกลง', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  REJECTED: { label: 'ปฏิเสธ', color: 'text-red-700', bgColor: 'bg-red-100' },
  EXPIRED: { label: 'หมดอายุ', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  CANCELLED: { label: 'ยกเลิก', color: 'text-gray-500', bgColor: 'bg-gray-100' },
};

function QuotationShareContent() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('id') || searchParams.get('q') || '';
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!quoteId) return;

    let cancelled = false;
    const fetchQuotation = async () => {
      try {
        const listRes = await fetch('/api/quotations?limit=100');
        if (listRes.ok) {
          const listData = await listRes.json();
          const found = listData.quotations?.find(
            (q: { id: string; quotationNumber: string }) =>
              q.id === quoteId || q.quotationNumber === quoteId
          );
          if (found) {
            const detailRes = await fetch(`/api/quotations/${found.id}`);
            if (detailRes.ok && !cancelled) {
              const data = await detailRes.json();
              const q = data.quotation;
              setStatus(q.status);
              setQuotation({
                quotationNumber: q.quotationNumber,
                customerName: q.customerName,
                customerPhone: q.customerPhone || '',
                customerEmail: q.customerEmail || '',
                customerAddress: q.customerAddress || '',
                origin: q.origin,
                destination: q.destination,
                expiryDays: q.expiryDays,
                notes: q.notes || '',
                trips: q.trips.map((t: Record<string, unknown>) => ({
                  id: t.id as string,
                  truckTypeId: t.truckTypeId as string,
                  truckName: t.truckName as string,
                  truckCBM: t.truckCBM as number,
                  truckMaxWeight: t.truckMaxWeight as number,
                  distance: t.distance as number,
                  dieselPrice: t.dieselPrice as number,
                  basePrice: t.basePrice as number,
                  laborCost: t.laborCost as number,
                  tripTotalPrice: t.tripTotalPrice as number,
                  numberOfTrips: 1,
                })),
                totalPrice: q.totalPrice,
                createdAt: q.createdAt,
              });
              return;
            }
          }
        }
        if (!cancelled) setError('ไม่พบใบเสนอราคา');
      } catch {
        if (!cancelled) setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchQuotation();
    return () => { cancelled = true; };
  }, [quoteId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">กำลังโหลดใบเสนอราคา...</p>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <div className="text-5xl mb-4">📄</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">ไม่พบใบเสนอราคา</h1>
          <p className="text-gray-600">{error || 'ไม่พบข้อมูลใบเสนอราคาที่คุณค้นหา'}</p>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10 no-print">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/ppy-logo.png" alt="PPY" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="font-bold text-gray-800 text-sm">ใบเสนอราคา</h1>
              <p className="text-xs text-gray-500">{quotation.quotationNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color} ${statusConfig.bgColor}`}>
              {statusConfig.label}
            </span>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition"
            >
              🖨️ พิมพ์
            </button>
          </div>
        </div>
      </div>

      {/* Quotation Content */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        <QuotationPreview quotation={quotation} />
      </div>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 text-center py-4 px-4 mt-8 no-print">
        <p className="text-xs">หจก.เผ่าปัญญา ทรานสปอร์ต | 98/6 หมู่ 5 ต.ศีรษะจรเข้ใหญ่ อ.บางเสาธง จ.สมุทรปราการ 10570</p>
      </footer>
    </div>
  );
}

export default function QuotationSharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">กำลังโหลด...</p>
        </div>
      </div>
    }>
      <QuotationShareContent />
    </Suspense>
  );
}
