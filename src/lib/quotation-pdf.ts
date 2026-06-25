/**
 * Quotation PDF Generator
 *
 * ใช้ html2pdf.js แปลง HTML element เป็นไฟล์ PDF
 * ออกแบบมาให้ทำงานกับ QuotationPreview component
 */

export async function generatePdf(
  element: HTMLElement,
  filename?: string
): Promise<void> {
  // Dynamic import เพื่อไม่ให้ html2pdf.js โหลดตอน build (SSR)
  const html2pdf = (await import('html2pdf.js')).default;

  const opt = {
    margin: 0,
    filename: filename || 'ใบเสนอราคา.pdf',
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  await html2pdf().set(opt).from(element).save();
}