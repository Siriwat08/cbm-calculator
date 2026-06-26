'use client';

import { formatThaiDate, formatThaiDateLong } from '@/lib/date-utils';
import type { QuotationData } from './QuotationForm';

interface QuotationPreviewProps {
  readonly quotation: QuotationData;
}

export default function QuotationPreview({ quotation }: QuotationPreviewProps) {
  const {
    quotationNumber,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    origin,
    destination,
    expiryDays,
    notes,
    trips,
    totalPrice,
    createdAt,
  } = quotation;

  // Calculate expiry date
  const getExpiryThaiDate = () => {
    try {
      const created = new Date(createdAt);
      const expiry = new Date(created);
      expiry.setDate(expiry.getDate() + expiryDays);
      const day = expiry.getDate().toString().padStart(2, '0');
      const month = (expiry.getMonth() + 1).toString().padStart(2, '0');
      const year = (expiry.getFullYear() + 543).toString();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const createdThaiDate = createdAt ? formatThaiDateLong(createdAt.split('T')[0] || createdAt) : formatThaiDateLong(new Date().toISOString().split('T')[0]);
  const createdShortDate = createdAt ? formatThaiDate(createdAt.split('T')[0] || createdAt) : formatThaiDate(new Date().toISOString().split('T')[0]);

  return (
    <>
      {/* Print-specific styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .quotation-print-area, .quotation-print-area * { visibility: visible; }
          .quotation-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            padding: 10mm 12mm;
            background: white;
            font-size: 10pt;
          }
          .no-print { display: none !important; }
          .qt-screen-wrapper { background: white !important; padding: 0 !important; }
        }

        @page {
          size: A4;
          margin: 0;
        }

        .qt-screen-wrapper {
          background: #e5e7eb;
          padding: 24px 16px;
          min-height: 100vh;
        }

        .quotation-print-area {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 10mm 12mm;
          background: white;
          font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #1a1a1a;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          font-size: 10pt;
          line-height: 1.5;
        }

        .qt-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          border-bottom: 2.5px solid #1e293b;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }

        .qt-logo {
          width: 64px;
          height: 64px;
          object-fit: contain;
          flex-shrink: 0;
          border-radius: 6px;
        }

        .qt-company-info {
          flex: 1;
        }

        .qt-company-name {
          font-size: 13pt;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 1px;
          letter-spacing: 0.3px;
        }

        .qt-company-detail {
          font-size: 8.5pt;
          color: #555;
          line-height: 1.45;
        }

        .qt-title-section {
          text-align: center;
          margin-bottom: 14px;
          padding: 6px 0;
          border-top: 1.5px solid #cbd5e1;
          border-bottom: 1.5px solid #cbd5e1;
          background: #f8fafc;
        }

        .qt-title {
          font-size: 16pt;
          font-weight: 700;
          color: #1e293b;
          letter-spacing: 3px;
        }

        .qt-subtitle {
          font-size: 9pt;
          color: #94a3b8;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .qt-meta {
          display: flex;
          justify-content: center;
          gap: 24px;
          font-size: 9.5pt;
          margin-top: 4px;
        }

        .qt-meta-item {
          display: flex;
          gap: 5px;
        }

        .qt-meta-label {
          color: #64748b;
        }

        .qt-meta-value {
          font-weight: 600;
          color: #1e293b;
        }

        .qt-info-grid {
          display: flex;
          gap: 16px;
          margin-bottom: 14px;
        }

        .qt-info-box {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          background: #fafbfc;
        }

        .qt-info-box-title {
          font-size: 8.5pt;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
          padding-bottom: 3px;
          border-bottom: 1px solid #f1f5f9;
        }

        .qt-info-row {
          display: flex;
          gap: 4px;
          font-size: 9.5pt;
          line-height: 1.55;
        }

        .qt-info-label {
          color: #64748b;
          min-width: 42px;
          flex-shrink: 0;
        }

        .qt-info-value {
          font-weight: 500;
          color: #1e293b;
          word-break: break-word;
        }

        .qt-route-highlight {
          text-align: center;
          margin-top: 6px;
          font-size: 12pt;
          color: #7c3aed;
          font-weight: 700;
        }

        .qt-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          font-size: 9.5pt;
        }

        .qt-table thead th {
          background: #1e293b;
          color: white;
          font-weight: 600;
          padding: 7px 8px;
          text-align: left;
          font-size: 8.5pt;
          letter-spacing: 0.5px;
        }

        .qt-table thead th:nth-child(3),
        .qt-table thead th:nth-child(4),
        .qt-table thead th:nth-child(5),
        .qt-table thead th:last-child {
          text-align: right;
        }

        .qt-table tbody td {
          padding: 6px 8px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
        }

        .qt-table tbody td:nth-child(3),
        .qt-table tbody td:nth-child(4),
        .qt-table tbody td:nth-child(5),
        .qt-table tbody td:last-child {
          text-align: right;
        }

        .qt-table tbody tr:nth-child(even) {
          background: #fafbfc;
        }

        .qt-truck-name {
          font-weight: 600;
          color: #1e293b;
        }

        .qt-truck-specs {
          color: #94a3b8;
          font-size: 8pt;
          margin-top: 1px;
        }

        .qt-items-list {
          margin-top: 4px;
          padding-top: 3px;
          border-top: 1px dashed #e2e8f0;
        }

        .qt-item-row {
          font-size: 8pt;
          color: #64748b;
          line-height: 1.5;
          padding-left: 8px;
        }

        .qt-table tfoot td {
          padding: 8px 8px;
          font-weight: 700;
          border-top: 2.5px solid #1e293b;
        }

        .qt-table tfoot td:last-child {
          text-align: right;
          font-size: 13pt;
          color: #7c3aed;
        }

        .qt-conditions {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 14px;
          background: #fafbfc;
        }

        .qt-conditions-title {
          font-size: 8.5pt;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }

        .qt-conditions ol {
          margin: 0;
          padding-left: 16px;
          font-size: 8.5pt;
          color: #64748b;
          line-height: 1.6;
        }

        .qt-conditions li {
          margin-bottom: 1px;
        }

        .qt-signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 28px;
          padding-top: 6px;
        }

        .qt-signature-box {
          text-align: center;
          width: 190px;
        }

        .qt-signature-line {
          border-top: 1px solid #94a3b8;
          margin-bottom: 5px;
          margin-top: 44px;
        }

        .qt-signature-label {
          font-size: 8.5pt;
          color: #64748b;
        }

        .qt-signature-sublabel {
          font-size: 7.5pt;
          color: #94a3b8;
        }

        .qt-notes {
          font-size: 8.5pt;
          color: #64748b;
          margin-bottom: 8px;
          font-style: italic;
          padding: 6px 10px;
          background: #fefce8;
          border-left: 3px solid #eab308;
          border-radius: 0 4px 4px 0;
        }

        .qt-footer {
          text-align: center;
          font-size: 7.5pt;
          color: #94a3b8;
          margin-top: 16px;
          padding-top: 6px;
          border-top: 1px solid #e2e8f0;
        }
      ` }} />

      <div className="qt-screen-wrapper">
        <div className="quotation-print-area">
          {/* Header */}
          <div className="qt-header">
            <img
              src="/images/ppy-logo.png"
              alt="เผ่าปัญญา ทรานสปอร์ต"
              className="qt-logo"
            />
            <div className="qt-company-info">
              <div className="qt-company-name">ห้างหุ้นส่วนจำกัด เผ่าปัญญา ทรานสปอร์ต</div>
              <div className="qt-company-detail">
                (สำนักงานใหญ่)<br />
                98/6 หมู่ที่ 5 ตำบลศีรษะจรเข้ใหญ่ อำเภอบางเสาธง จังหวัดสมุทรปราการ 10570<br />
                โทร: 02-003-2390 &nbsp;|&nbsp; เลขประจำตัวผู้เสียภาษี: 0113560001713
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="qt-title-section">
            <div className="qt-title">ใบเสนอราคา</div>
            <div className="qt-subtitle">QUOTATION</div>
            <div className="qt-meta">
              <div className="qt-meta-item">
                <span className="qt-meta-label">เลขที่:</span>
                <span className="qt-meta-value">{quotationNumber}</span>
              </div>
              <div className="qt-meta-item">
                <span className="qt-meta-label">วันที่:</span>
                <span className="qt-meta-value">{createdShortDate}</span>
              </div>
              <div className="qt-meta-item">
                <span className="qt-meta-label">หมดอายุ:</span>
                <span className="qt-meta-value">{getExpiryThaiDate()}</span>
              </div>
            </div>
          </div>

          {/* Info Grid: Customer + Route */}
          <div className="qt-info-grid">
            <div className="qt-info-box">
              <div className="qt-info-box-title">ข้อมูลลูกค้า / Customer</div>
              <div className="qt-info-row">
                <span className="qt-info-label">ชื่อ:</span>
                <span className="qt-info-value">{customerName}</span>
              </div>
              {customerAddress && (
                <div className="qt-info-row">
                  <span className="qt-info-label">ที่อยู่:</span>
                  <span className="qt-info-value">{customerAddress}</span>
                </div>
              )}
              {customerPhone && (
                <div className="qt-info-row">
                  <span className="qt-info-label">โทร:</span>
                  <span className="qt-info-value">{customerPhone}</span>
                </div>
              )}
              {customerEmail && (
                <div className="qt-info-row">
                  <span className="qt-info-label">อีเมล:</span>
                  <span className="qt-info-value">{customerEmail}</span>
                </div>
              )}
            </div>
            <div className="qt-info-box">
              <div className="qt-info-box-title">เส้นทาง / Route</div>
              <div className="qt-info-row">
                <span className="qt-info-label">ต้นทาง:</span>
                <span className="qt-info-value">{origin}</span>
              </div>
              <div className="qt-info-row">
                <span className="qt-info-label">ปลายทาง:</span>
                <span className="qt-info-value">{destination}</span>
              </div>
              <div className="qt-route-highlight">
                {origin} → {destination}
              </div>
            </div>
          </div>

          {/* Trips Table */}
          <table className="qt-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>ลำดับ</th>
                <th style={{ width: '38%' }}>รายการขนส่ง</th>
                <th style={{ width: '12%' }}>ระยะทาง</th>
                <th style={{ width: '12%' }}>ราคา/เที่ยว</th>
                <th style={{ width: '10%' }}>จำนวนเที่ยว</th>
                <th style={{ width: '13%' }}>ราคารวม</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip, index) => (
                <tr key={trip.id || index}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="qt-truck-name">{trip.truckName}</div>
                    <div className="qt-truck-specs">
                      CBM {trip.truckCBM} | น้ำหนัก {trip.truckMaxWeight?.toLocaleString() || '-'} kg
                    </div>
                    {/* Show items if available */}
                    {trip.items && trip.items.length > 0 && (
                      <div className="qt-items-list">
                        {trip.items.map((item, itemIdx) => (
                          <div key={`${item.name || 'item'}-${item.width}x${item.length}x${item.height}-${item.quantity}`} className="qt-item-row">
                            {item.name ? `${item.name}: ` : ''}{item.width}×{item.length}×{item.height} ซม. × {item.quantity} ชิ้น ({item.weight} kg)
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{trip.distance > 0 ? `${trip.distance.toLocaleString()} กม.` : '-'}</td>
                  <td>{(trip.basePrice || 0).toLocaleString()}</td>
                  <td>{trip.numberOfTrips || 1}</td>
                  <td>{(trip.tripTotalPrice || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}>รวมทั้งหมด (THB)</td>
                <td>{totalPrice.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          {/* Notes */}
          {notes && (
            <div className="qt-notes">
              หมายเหตุ: {notes}
            </div>
          )}

          {/* Conditions */}
          <div className="qt-conditions">
            <div className="qt-conditions-title">เงื่อนไข / Terms &amp; Conditions</div>
            <ol>
              <li>ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม (VAT 7%)</li>
              <li>ราคาอาจเปลี่ยนแปลงตามราคาน้ำมันดีเซล</li>
              <li>ใบเสนอราคานี้มีอายุ {expiryDays} วัน นับจากวันออก ({createdThaiDate})</li>
              <li>การยืนยันสั่งงานถือว่ายอมรับเงื่อนไขทั้งหมด</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="qt-signatures">
            <div className="qt-signature-box">
              <div className="qt-signature-line"></div>
              <div className="qt-signature-label">ผู้เสนอราคา</div>
              <div className="qt-signature-sublabel">Issued by</div>
            </div>
            <div className="qt-signature-box">
              <div className="qt-signature-line"></div>
              <div className="qt-signature-label">ผู้สั่งซื้อ</div>
              <div className="qt-signature-sublabel">Accepted by</div>
            </div>
          </div>

          {/* Footer */}
          <div className="qt-footer">
            หจก.เผ่าปัญญา ทรานสปอร์ต | 98/6 หมู่ 5 ต.ศีรษะจรเข้ใหญ่ อ.บางเสาธง จ.สมุทรปราการ 10570 | โทร 02-003-2390
          </div>
        </div>
      </div>
    </>
  );
}
