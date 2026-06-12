---
Task ID: quotation-feature-1
Agent: full-stack-developer
Task: Build Quotation Generator UI + PDF Preview

Work Log:
- Explored existing project structure — found quotation components already partially implemented
- Improved QuotationPreview.tsx with production-ready A4 preview
- Improved QuotationForm.tsx with items support, textarea, route pre-fill
- Improved QuotationList.tsx with Dialog viewing, status dropdown
- Created /quotation/[id]/page.tsx dynamic route for public sharing
- Modified page.tsx to pass route info to QuotationForm
- TypeScript check passes for all quotation files

Stage Summary:
- QuotationPreview: Professional A4 print-optimized layout with gray background, items in trips, Thai Buddhist dates
- QuotationForm: Items support, textarea for notes, route pre-fill from distance lookup
- QuotationList: Dialog viewing, status dropdown, polished table UI
- Public share page: /quotation/[id] dynamic route with status badge and print support
- All dates use พ.ศ. (Buddhist era) throughout
- No PromptPay QR (as explicitly requested)
