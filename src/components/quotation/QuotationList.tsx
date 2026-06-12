'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatThaiDate } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import QuotationPreview from './QuotationPreview';
import type { QuotationData } from './QuotationForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface QuotationListProps {
  adminApiKey: string;
  onRefresh?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  DRAFT: { label: 'ร่าง', color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-300' },
  SENT: { label: 'ส่งแล้ว', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  ACCEPTED: { label: 'ตกลง', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  REJECTED: { label: 'ปฏิเสธ', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  EXPIRED: { label: 'หมดอายุ', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  CANCELLED: { label: 'ยกเลิก', color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
};

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '📝 ร่าง' },
  { value: 'SENT', label: '📤 ส่งแล้ว' },
  { value: 'ACCEPTED', label: '✅ ตกลง' },
  { value: 'REJECTED', label: '❌ ปฏิเสธ' },
  { value: 'EXPIRED', label: '⏰ หมดอายุ' },
  { value: 'CANCELLED', label: '🚫 ยกเลิก' },
];

interface QuotationRecord {
  id: string;
  quotationNumber: string;
  status: string;
  customerName: string;
  origin: string;
  destination: string;
  totalPrice: number;
  expiryDays: number;
  notes: string | null;
  createdAt: string;
  trips: {
    id: string;
    truckTypeId: string;
    truckName: string;
    truckCBM: number;
    truckMaxWeight: number;
    distance: number;
    dieselPrice: number;
    basePrice: number;
    laborCost: number;
    tripTotalPrice: number;
    items?: {
      name?: string;
      width: number;
      length: number;
      height: number;
      quantity: number;
      weight: number;
    }[];
  }[];
}

export default function QuotationList({ adminApiKey }: QuotationListProps) {
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingQuotation, setViewingQuotation] = useState<QuotationData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    try {
      const res = await fetch('/api/quotations?limit=50');
      if (res.ok) {
        const data = await res.json();
        setQuotations(data.quotations || []);
      }
    } catch {
      console.error('Failed to fetch quotations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await fetchQuotations();
      if (cancelled) return;
    };
    load();
    return () => { cancelled = true; };
  }, [fetchQuotations]);

  const handleDelete = async (id: string, quotationNumber: string) => {
    if (!confirm(`ต้องการลบใบเสนอราคา ${quotationNumber} ใช่หรือไม่?`)) return;
    if (!adminApiKey) {
      toast({ title: 'กรุณาใส่รหัสแอดมิน', variant: 'destructive' });
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': adminApiKey },
      });
      if (res.status === 401) {
        toast({ title: 'ไม่มีสิทธิ์', description: 'รหัสแอดมินไม่ถูกต้อง', variant: 'destructive' });
        return;
      }
      if (res.ok) {
        toast({ title: 'ลบสำเร็จ', description: `ลบ ${quotationNumber} เรียบร้อย` });
        fetchQuotations();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: 'ลบไม่สำเร็จ', description: data.error || 'เกิดข้อผิดพลาด', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const handleView = async (id: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`);
      if (res.ok) {
        const data = await res.json();
        const q = data.quotation;
        const quotationData: QuotationData = {
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
            items: Array.isArray(t.items) ? (t.items as Record<string, unknown>[]).map((item) => ({
              name: item.name as string || undefined,
              width: item.width as number,
              length: item.length as number,
              height: item.height as number,
              quantity: item.quantity as number,
              weight: item.weight as number,
            })) : [],
          })),
          totalPrice: q.totalPrice,
          createdAt: q.createdAt,
        };
        setViewingQuotation(quotationData);
        setDialogOpen(true);
      }
    } catch {
      toast({ title: 'ไม่สามารถดูข้อมูลได้', variant: 'destructive' });
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!adminApiKey) {
      toast({ title: 'กรุณาใส่รหัสแอดมิน', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': adminApiKey,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: 'อัปเดตสถานะสำเร็จ', description: `เปลี่ยนเป็น ${STATUS_CONFIG[status]?.label || status}` });
        fetchQuotations();
      } else {
        toast({ title: 'อัปเดตไม่สำเร็จ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  const copyShareLink = (quotationNumber: string) => {
    const link = `${window.location.origin}/quotation/${quotationNumber}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: 'คัดลอกลิงก์สำเร็จ', description: link });
    }).catch(() => {
      toast({ title: 'คัดลอกไม่สำเร็จ', variant: 'destructive' });
    });
  };

  return (
    <>
      <section className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-lg font-bold">📋 รายการใบเสนอราคา</h2>
            <p className="text-slate-300 text-sm">จัดการใบเสนอราคาทั้งหมด</p>
          </div>
          <button
            onClick={fetchQuotations}
            className="bg-white text-slate-700 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-100 transition text-sm"
          >
            🔄 รีเฟรช
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-2">กำลังโหลด...</p>
            </div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">📄 ยังไม่มีใบเสนอราคา</p>
              <p className="text-sm mt-1">สร้างใบเสนอราคาใหม่ได้จากแบบฟอร์มด้านบน</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="text-left py-2.5 px-3 text-gray-600 font-medium text-sm">เลขที่</th>
                    <th className="text-left py-2.5 px-3 text-gray-600 font-medium text-sm">ลูกค้า</th>
                    <th className="text-left py-2.5 px-3 text-gray-600 font-medium text-sm hidden md:table-cell">เส้นทาง</th>
                    <th className="text-right py-2.5 px-3 text-gray-600 font-medium text-sm">ราคารวม</th>
                    <th className="text-center py-2.5 px-3 text-gray-600 font-medium text-sm">สถานะ</th>
                    <th className="text-left py-2.5 px-3 text-gray-600 font-medium text-sm hidden sm:table-cell">วันที่สร้าง</th>
                    <th className="text-center py-2.5 px-3 text-gray-600 font-medium text-sm">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => {
                    const statusConfig = STATUS_CONFIG[q.status] || STATUS_CONFIG.DRAFT;
                    return (
                      <tr key={q.id} className="border-b hover:bg-gray-50 transition">
                        <td className="py-2.5 px-3 font-mono text-sm font-medium text-purple-700">{q.quotationNumber}</td>
                        <td className="py-2.5 px-3 text-sm">{q.customerName}</td>
                        <td className="py-2.5 px-3 text-sm text-gray-600 hidden md:table-cell">
                          <span className="truncate max-w-[160px] block">{q.origin}</span>
                          <span className="text-gray-400">↓</span>
                          <span className="truncate max-w-[160px] block">{q.destination}</span>
                        </td>
                        <td className="py-2.5 px-3 text-sm font-medium text-right">{q.totalPrice.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color} ${statusConfig.bgColor} ${statusConfig.borderColor} hover:opacity-80 transition cursor-pointer`}
                              >
                                {statusConfig.label}
                                <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                              {STATUS_OPTIONS.map(opt => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  onClick={() => handleUpdateStatus(q.id, opt.value)}
                                  className={q.status === opt.value ? 'bg-gray-100 font-medium' : ''}
                                >
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="py-2.5 px-3 text-sm text-gray-500 hidden sm:table-cell">
                          {formatThaiDate(q.createdAt?.split('T')[0] || q.createdAt)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleView(q.id)}
                              className="text-purple-600 hover:text-purple-800 text-sm p-1 rounded hover:bg-purple-50 transition"
                              title="ดู"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => copyShareLink(q.quotationNumber)}
                              className="text-emerald-600 hover:text-emerald-800 text-sm p-1 rounded hover:bg-emerald-50 transition"
                              title="คัดลอกลิงก์"
                            >
                              🔗
                            </button>
                            {deleting === q.id ? (
                              <span className="animate-spin w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full inline-block"></span>
                            ) : (
                              <button
                                onClick={() => handleDelete(q.id, q.quotationNumber)}
                                className="text-red-400 hover:text-red-600 text-sm p-1 rounded hover:bg-red-50 transition"
                                title="ลบ"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Dialog for viewing quotation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-3">
              📄 ดูใบเสนอราคา
              {viewingQuotation && (
                <span className="text-sm font-mono text-purple-600">{viewingQuotation.quotationNumber}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-4">
            <div className="flex flex-wrap gap-2 mb-4 px-4 no-print">
              <Button
                variant="default"
                className="bg-slate-800 hover:bg-slate-700"
                onClick={() => window.print()}
                size="sm"
              >
                🖨️ พิมพ์ใบเสนอราคา
              </Button>
              {viewingQuotation && (
                <Button
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => copyShareLink(viewingQuotation.quotationNumber)}
                  size="sm"
                >
                  🔗 คัดลอกลิงก์
                </Button>
              )}
            </div>
            {viewingQuotation && <QuotationPreview quotation={viewingQuotation} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
