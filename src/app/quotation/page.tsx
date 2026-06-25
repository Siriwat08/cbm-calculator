'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QuotationPreview from '@/components/quotation/QuotationPreview';
import { decodeQuotationData, type QuotationData } from '@/components/quotation/QuotationForm';
import { generatePdf } from '@/lib/quotation-pdf';
import { useRef } from 'react';

function QuotationShareContent() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get('q') || '';
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!encoded) {
      setError('ไม่พบข้อมูลใบเสนอราคา');
      setLoading(false);
      return;
    }

    const data = decodeQuotationData(encoded);
    if (data) {
      setQuotation(data);
    } else {
      setError('ข้อมูลใบเสนอราคาไม่ถูกต้อง หรือลิงก์หมดอายุ');
    }
    setLoading(false);
  }, [encoded]);

  const handleDownloadPdf = async () => {
    if (!previewRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await generatePdf(previewRef.current, `${quotation?.quotationNumber || 'ใบเสนอราคา'}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

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
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
            >
              {isGeneratingPdf ? 'กำลังสร้าง PDF...' : '📄 ดาวน์โหลด PDF'}
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
            >
              🖨️ พิมพ์
            </button>
          </div>
        </div>
      </div>

      {/* Quotation Content */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        <div ref={previewRef}>
          <QuotationPreview quotation={quotation} />
        </div>
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