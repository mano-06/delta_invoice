import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const settingsDefaults = {
  companyName: '',
  address1: '',
  address2: '',
  city: '',
  pincode: '',
  gstin: '',
  stateName: '',
  email: '',
  companyLogo: '',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getAddressLines(settings = {}) {
  const address = [settings.address1, settings.address2, settings.city, settings.pincode]
    .filter(Boolean)
  return address.join(', ')
}

// ─── GST Invoice styles ───────────────────────────────────────────────────────
function getInvoicePrintStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;700&display=swap');
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: 'Fututa Cyrillic', 'Futura Cyrillic', 'Futura-Cyrillic', 'Futura PT', 'Futura', 'Jost', sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.35;
      letter-spacing: -0.015em;
    }
    .invoice-sheet {
      width: 210mm;
      min-height: 296mm;
      padding: 12mm 12mm 10mm 12mm;
      margin: 0 auto;
      background: #ffffff;
      color: #111827;
      border: none;
      border-radius: 0;
      box-shadow: none;
      font-family: 'Fututa Cyrillic', 'Futura Cyrillic', 'Futura-Cyrillic', 'Futura PT', 'Futura', 'Jost', sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.35;
      box-sizing: border-box;
      letter-spacing: -0.015em;
    }
    .invoice-sheet * {
      box-sizing: border-box;
      box-shadow: none;
      border-radius: 0;
    }
    .invoice-sheet h1,
    .invoice-sheet h2,
    .invoice-sheet h3,
    .invoice-sheet p,
    .invoice-sheet span,
    .invoice-sheet td,
    .invoice-sheet th {
      color: #111827;
    }
    .invoice-sheet h1 {
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: 0;
    }
    .invoice-sheet h2 {
      font-size: 12pt;
      font-weight: 700;
    }
    .invoice-sheet h3 {
      font-size: 11pt;
      font-weight: 700;
    }
    .invoice-title {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    .invoice-table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    .invoice-table th,
    .invoice-table td {
      border: 1px solid #111827;
      padding: 5px 7px;
      vertical-align: top;
      font-size: 11pt;
      font-weight: 400;
    }
    .invoice-table thead th { border-top: 1px solid #111827; }

    /* ── Company header: full-width single row ── */
    .invoice-company-header {
      border: 1px solid #111827;
      border-bottom: 0;
      display: flex;
      align-items: stretch;
      min-height: 80px;
    }
    .invoice-company-logo {
      width: 80px;
      min-width: 80px;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #111827;
    }
    .invoice-company-logo img {
      max-width: 64px;
      max-height: 64px;
      object-fit: contain;
    }
    .invoice-company-name-block {
      flex: 1;
      padding: 8px 12px;
    }
    .invoice-company-address-block {
      width: 40%;
      padding: 8px 12px;
      border-left: 1px solid #111827;
      text-align: right;
    }

    /* ── Buyer + Invoice meta: two-column row below header ── */
    .invoice-buyer-meta-row {
      border: 1px solid #111827;
      border-bottom: 0;
      display: flex;
    }
    .invoice-buyer-col {
      width: 55%;
      padding: 8px;
      border-right: 1px solid #111827;
    }
    .invoice-meta-col {
      width: 45%;
      display: flex;
      flex-direction: column;
    }
    .invoice-meta-row {
      display: grid;
      grid-template-columns: 45% 55%;
      border-bottom: 1px solid #111827;
    }
    .invoice-meta-row:last-child {
      border-bottom: 0;
    }
    .invoice-label {
      font-weight: 700;
      padding: 5px 7px;
      border-right: 1px solid #111827;
      font-size: 11pt;
    }
    .invoice-meta-value {
      padding: 5px 7px;
      font-weight: 400;
      font-size: 11pt;
    }
    .buyer-block {
      padding: 8px;
      min-height: 120px;
    }
    .invoice-company {
      font-weight: 700;
      font-size: 14pt;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    /* Keep old grid wrapper for table border continuity */
    .invoice-grid-wrapper {
      border-top: 1px solid #111827;
      border-left: 1px solid #111827;
      border-right: 1px solid #111827;
    }
    .invoice-grid {
      display: none;
    }
    .company-block,
    .buyer-block,
    .footer-block,
    .summary-block {
      background: #ffffff;
      font-weight: 400;
    }
    .invoice-amounts {
      border: 1px solid #111827;
      border-top: 0;
    }
    .invoice-summary-grid {
      display: grid;
      grid-template-columns: 1fr;
    }
    .invoice-summary-row {
      display: grid;
      grid-template-columns: 1fr auto;
      border-bottom: 1px solid #111827;
    }
    .invoice-summary-row:last-child {
      border-bottom: 0;
    }
    .invoice-footer {
      display: grid;
      grid-template-columns: 55% 45%;
      border: 1px solid #111827;
      border-top: 0;
    }
    .footer-block {
      border: 0;
      padding: 8px;
    }
    .invoice-signature-line {
      margin-top: 70px;
      border-top: 1px solid #111827;
      width: 50%;
      margin-left: auto;
    }
    .invoice-note {
      text-align: center;
      font-size: 10pt;
      letter-spacing: 1px;
      padding: 6px 0 0;
    }
    .invoice-small {
      font-size: 11pt;
      font-weight: 400;
      line-height: 1.5;
    }
    @page {
      margin: 0;
      size: A4 portrait;
    }
    @media print {
      body {
        background: #fff;
        margin: 0;
      }
      .invoice-sheet {
        width: 210mm;
        min-height: 296mm;
        padding: 12mm 12mm 10mm 12mm;
        margin: 0;
        border: none;
        page-break-inside: avoid;
      }
      * {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `
}

// ─── NO-GST Invoice styles — mirrors GST styles exactly, no GST-specific rules ─
function getNoGstPrintStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;700&display=swap');
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: 'Fututa Cyrillic', 'Futura Cyrillic', 'Futura-Cyrillic', 'Futura PT', 'Futura', 'Jost', sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.35;
      letter-spacing: -0.015em;
    }
    .invoice-sheet {
      width: 210mm;
      min-height: 296mm;
      padding: 12mm 12mm 10mm 12mm;
      margin: 0 auto;
      background: #ffffff;
      color: #111827;
      border: none;
      border-radius: 0;
      box-shadow: none;
      font-family: 'Fututa Cyrillic', 'Futura Cyrillic', 'Futura-Cyrillic', 'Futura PT', 'Futura', 'Jost', sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.35;
      box-sizing: border-box;
      letter-spacing: -0.015em;
    }
    .invoice-sheet * {
      box-sizing: border-box;
      box-shadow: none;
      border-radius: 0;
    }
    .invoice-sheet h1,
    .invoice-sheet h2,
    .invoice-sheet h3,
    .invoice-sheet p,
    .invoice-sheet span,
    .invoice-sheet td,
    .invoice-sheet th {
      color: #111827;
    }
    .invoice-sheet h1 { font-size: 20pt; font-weight: 700; }
    .invoice-sheet h2 { font-size: 12pt; font-weight: 700; }
    .invoice-sheet h3 { font-size: 11pt; font-weight: 700; }
    .invoice-title {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    .invoice-table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    .invoice-table th,
    .invoice-table td {
      border: 1px solid #111827;
      padding: 5px 7px;
      vertical-align: top;
      font-size: 11pt;
      font-weight: 400;
    }
    .invoice-table thead th { border-top: 1px solid #111827; }

    /* ── Company header ── */
    .invoice-company-header {
      border: 1px solid #111827;
      border-bottom: 0;
      display: flex;
      align-items: stretch;
      min-height: 80px;
    }
    .invoice-company-logo {
      width: 80px;
      min-width: 80px;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #111827;
    }
    .invoice-company-logo img {
      max-width: 64px;
      max-height: 64px;
      object-fit: contain;
    }
    .invoice-company-name-block {
      flex: 1;
      padding: 8px 12px;
    }
    .invoice-company-address-block {
      width: 40%;
      padding: 8px 12px;
      border-left: 1px solid #111827;
      text-align: right;
    }

    /* ── Buyer + Invoice meta ── */
    .invoice-buyer-meta-row {
      border: 1px solid #111827;
      border-bottom: 0;
      display: flex;
    }
    .invoice-buyer-col {
      width: 55%;
      padding: 8px;
      border-right: 1px solid #111827;
    }
    .invoice-meta-col {
      width: 45%;
      display: flex;
      flex-direction: column;
    }
    .invoice-meta-row {
      display: grid;
      grid-template-columns: 45% 55%;
      border-bottom: 1px solid #111827;
    }
    .invoice-meta-row:last-child { border-bottom: 0; }
    .invoice-label {
      font-weight: 700;
      padding: 5px 7px;
      border-right: 1px solid #111827;
      font-size: 11pt;
    }
    .invoice-meta-value {
      padding: 5px 7px;
      font-weight: 400;
      border-bottom: 1px solid #111827;
      font-size: 11pt;
    }
    .invoice-company {
      font-weight: 700;
      font-size: 14pt;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .invoice-small {
      font-size: 11pt;
      font-weight: 400;
      line-height: 1.5;
    }
    @page {
      margin: 0;
      size: A4 portrait;
    }
    @media print {
      body { background: #fff; margin: 0; }
      .invoice-sheet {
        width: 210mm;
        min-height: 296mm;
        padding: 12mm 12mm 10mm 12mm;
        margin: 0;
        border: none;
        page-break-inside: avoid;
      }
      * {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `
}

// ─── GST Invoice body builder ─────────────────────────────────────────────────
function buildInvoiceBody(payload, withGst = true) {
  const invoice = payload.invoice || {}
  const settings = { ...settingsDefaults, ...(payload.settings || {}) }
  const items = Array.isArray(payload.items) ? payload.items : []
  const totals = payload.totals || {}
  const amountWords = invoice.amountWords || totals.amountWords || ''
  const buyerAddress =
    [invoice.buyerAddressLine1, invoice.buyerAddressLine2].filter(Boolean).join('<br/>') ||
    escapeHtml(invoice.buyerAddress || '')

  const taxableValue = Number(totals.taxableValue || 0)
  const cgstAmount = Number(totals.cgstAmount || 0)
  const sgstAmount = Number(totals.sgstAmount || 0)
  const totalTax = cgstAmount + sgstAmount
  const totalAmount = Number(totals.totalAmount || totals.finalAmount || taxableValue + totalTax)
  const noGstTotal = taxableValue

  const rows = items
    .map((item, index) => {
      const amount = Number(item.quantity || 0) * Number(item.rate || 0)
      return `
        <tr>
          <td style="width:5%;text-align:center;font-weight:400;">${index + 1}</td>
          <td style="width:${withGst ? '38%' : '48%'};font-weight:400;">${escapeHtml(item.description || '')}</td>
          ${withGst ? `<td style="width:10%;text-align:right;font-weight:400;">${escapeHtml(item.hsn || '')}</td>` : ''}
          <td style="width:12%;text-align:right;font-weight:400;">${item.quantity ? Number(item.quantity).toLocaleString('en-IN') : ''}</td>
          <td style="width:11%;text-align:right;font-weight:400;">${item.rate ? Number(item.rate).toFixed(2) : ''}</td>
          <td style="width:8%;text-align:right;font-weight:400;">${escapeHtml(item.unit || '')}</td>
          <td style="width:${withGst ? '16%' : '21%'};text-align:right;font-weight:400;">${amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
        </tr>
      `
    })
    .join('')

  const gstTotalsRows = withGst ? `
    <tr>
      <td colspan="${withGst ? 6 : 5}" style="text-align:right;border-right:1px solid #111827;">CGST 2.5%</td>
      <td style="text-align:right;">${Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
    <tr>
      <td colspan="${withGst ? 6 : 5}" style="text-align:right;border-right:1px solid #111827;">SGST 2.5%</td>
      <td style="text-align:right;">${Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  ` : ''

  const hsnSummary = items.reduce((acc, item) => {
    const hsn = item.hsn || 'N/A'
    const taxable = Number(item.quantity || 0) * Number(item.rate || 0)
    acc[hsn] = (acc[hsn] || 0) + taxable
    return acc
  }, {})

  const hsnRows = Object.entries(hsnSummary)
    .map(([hsn, taxable]) => {
      const cgst = Number((Number(taxable) * 0.025).toFixed(2))
      const sgst = Number((Number(taxable) * 0.025).toFixed(2))
      return `
        <tr>
          <td style="padding:2px 5px;border-right:1px solid #111827;">${escapeHtml(hsn)}</td>
          <td style="padding:2px 5px;text-align:right;border-right:1px solid #111827;">${Number(taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="padding:2px 5px;text-align:right;border-right:1px solid #111827;">2.50%</td>
          <td style="padding:2px 5px;text-align:right;border-right:1px solid #111827;">${Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="padding:2px 5px;text-align:right;border-right:1px solid #111827;">2.50%</td>
          <td style="padding:2px 5px;text-align:right;border-right:1px solid #111827;">${Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="padding:2px 5px;text-align:right;">${Number(cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `
    })
    .join('')

  const hsnBlock = withGst ? `
    <div class="invoice-amounts">
      <table class="invoice-table" style="border:0;background-color:#ffffff;">
        <thead>
          <tr>
            <th style="border:1px solid #111827;border-right:0;width:14%;background-color:#ffffff;">HSN/SAC</th>
            <th style="border:1px solid #111827;border-right:0;width:18%;text-align:right;background-color:#ffffff;">Taxable Value</th>
            <th style="border:1px solid #111827;border-right:0;width:9%;text-align:center;background-color:#ffffff;" colspan="2">Central Tax</th>
            <th style="border:1px solid #111827;border-right:0;width:9%;text-align:center;background-color:#ffffff;" colspan="2">State Tax</th>
            <th style="border:1px solid #111827;width:22%;text-align:right;background-color:#ffffff;">Total Tax Amount</th>
          </tr>
          <tr>
            <th style="border:1px solid #111827;border-top:0;border-right:0;"></th>
            <th style="border:1px solid #111827;border-top:0;border-right:0;"></th>
            <th style="border:1px solid #111827;border-top:0;border-right:0;text-align:right;">Rate</th>
            <th style="border:1px solid #111827;border-top:0;border-right:0;text-align:right;">Amount</th>
            <th style="border:1px solid #111827;border-top:0;border-right:0;text-align:right;">Rate</th>
            <th style="border:1px solid #111827;border-top:0;border-right:0;text-align:right;">Amount</th>
            <th style="border:1px solid #111827;border-top:0;text-align:right;"></th>
          </tr>
        </thead>
        <tbody>
          ${hsnRows || '<tr><td colspan="7">No items</td></tr>'}
          <tr>
            <td style="border:1px solid #111827;border-top:0;border-right:0;font-weight:700;">Total</td>
            <td style="border:1px solid #111827;border-top:0;border-right:0;text-align:right;font-weight:700;">${Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="border:1px solid #111827;border-top:0;border-right:0;"></td>
            <td style="border:1px solid #111827;border-top:0;border-right:0;text-align:right;font-weight:700;">${Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="border:1px solid #111827;border-top:0;border-right:0;"></td>
            <td style="border:1px solid #111827;border-top:0;border-right:0;text-align:right;font-weight:700;">${Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="border:1px solid #111827;border-top:0;text-align:right;font-weight:400;">${Number(totalTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
      <div style="padding:3px 8px;border-top:1px solid #111827;font-size:9pt;font-weight:400;">
        <strong>Tax Amount (in words):</strong> ${escapeHtml(totals.taxAmountWords || '')}
      </div>
    </div>
  ` : ''

  const grandTotal = withGst ? totalAmount : noGstTotal
  const colspanLabel = withGst ? 6 : 5

  return `
    <!-- ── Company header ── -->
    <div class="invoice-company-header">
      <div class="invoice-company-logo">
        ${settings.companyLogo
          ? `<img src="${settings.companyLogo}" alt="Logo" />`
          : `<div style="width:64px;height:64px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#aaa;text-align:center;">LOGO</div>`
        }
      </div>
      <div class="invoice-company-name-block">
        <div class="invoice-company">${escapeHtml(settings.companyName)}</div>
        ${withGst ? `<div class="invoice-small">GSTIN/UIN : ${escapeHtml(settings.gstin || '')}</div>` : ''}
        <div class="invoice-small">State Name : ${escapeHtml(settings.stateName || '')}</div>
      </div>
      <div class="invoice-company-address-block">
        <div class="invoice-small">${escapeHtml(settings.address1 || '')}</div>
        ${settings.address2 ? `<div class="invoice-small">${escapeHtml(settings.address2)}</div>` : ''}
        <div class="invoice-small">${escapeHtml([settings.city, settings.pincode].filter(Boolean).join(' - '))}</div>
        <div class="invoice-small">E-Mail : ${escapeHtml(settings.email || '')}</div>
      </div>
    </div>

    <!-- ── Buyer + Invoice meta ── -->
    <div class="invoice-buyer-meta-row">
      <div class="invoice-buyer-col">
        <div style="font-weight:700;font-size:14pt;margin-bottom:4px;">Buyer (Bill to)</div>
        <div style="font-weight:700;font-size:12pt;margin-bottom:3px;">${escapeHtml(invoice.buyerName || '')}</div>
        <div class="invoice-small">${buyerAddress}</div>
        ${withGst ? `<div class="invoice-small" style="margin-top:3px;">GSTIN/UIN : ${escapeHtml(invoice.buyerGstin || '')}</div>` : ''}
        <div class="invoice-small">State Name : ${escapeHtml(invoice.buyerState || '')}</div>
      </div>
      <div class="invoice-meta-col">
        <div class="invoice-meta-row">
          <div class="invoice-label">Invoice No.</div>
          <div class="invoice-meta-value">${escapeHtml(invoice.invoiceNumber || '')}</div>
        </div>
        <div class="invoice-meta-row">
          <div class="invoice-label">Dated</div>
          <div class="invoice-meta-value">${escapeHtml(invoice.invoiceDate || '')}</div>
        </div>
        ${invoice.deliveryNote ? `<div class="invoice-meta-row"><div class="invoice-label">Delivery Note</div><div class="invoice-meta-value">${escapeHtml(invoice.deliveryNote)}</div></div>` : ''}
        ${invoice.paymentTerms ? `<div class="invoice-meta-row"><div class="invoice-label">Terms of Payment</div><div class="invoice-meta-value">${escapeHtml(invoice.paymentTerms)}</div></div>` : ''}
      </div>
    </div>

    <!-- ── Line items table ── -->
    <table class="invoice-table" style="border-top:1px solid #111827;">
      <colgroup>
        <col style="width:5%"/>
        <col style="width:${withGst ? '38%' : '48%'}"/>
        ${withGst ? `<col style="width:10%"/>` : ''}
        <col style="width:12%"/>
        <col style="width:11%"/>
        <col style="width:8%"/>
        <col style="width:${withGst ? '16%' : '21%'}"/>
      </colgroup>
      <thead>
        <tr>
          <th style="text-align:center;font-size:11pt;">Sl No.</th>
          <th style="font-size:11pt;">Description of Goods</th>
          ${withGst ? `<th style="text-align:right;font-size:11pt;">HSN/SAC</th>` : ''}
          <th style="text-align:right;font-size:11pt;">Quantity</th>
          <th style="text-align:right;font-size:11pt;">Rate</th>
          <th style="text-align:right;font-size:11pt;">per</th>
          <th style="text-align:right;font-size:11pt;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="${withGst ? 7 : 6}" style="padding:0;height:380px;vertical-align:top;border:0;">
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;height:100%;">
              <colgroup>
                <col style="width:5%"/>
                <col style="width:${withGst ? '38%' : '48%'}"/>
                ${withGst ? `<col style="width:10%"/>` : ''}
                <col style="width:12%"/>
                <col style="width:11%"/>
                <col style="width:8%"/>
                <col style="width:${withGst ? '16%' : '21%'}"/>
              </colgroup>
              <tbody>
                <tr style="height:100%;">
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  ${withGst ? `<td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>` : ''}
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="padding:0;vertical-align:top;"></td>
                </tr>
              </tbody>
            </table>
            <div style="position:relative;margin-top:-380px;pointer-events:none;">
              <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <colgroup>
                  <col style="width:5%"/>
                  <col style="width:${withGst ? '38%' : '48%'}"/>
                  ${withGst ? `<col style="width:10%"/>` : ''}
                  <col style="width:12%"/>
                  <col style="width:11%"/>
                  <col style="width:8%"/>
                  <col style="width:${withGst ? '16%' : '21%'}"/>
                </colgroup>
                <tbody>
                  ${rows || ''}
                </tbody>
              </table>
            </div>
          </td>
        </tr>

        ${gstTotalsRows}
        <tr>
          <td colspan="${colspanLabel}" style="text-align:right;border-right:1px solid #111827;font-weight:700;font-size:12pt;">Total</td>
          <td style="text-align:right;font-weight:700;font-size:12pt;">₹ ${Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>

    ${hsnBlock}

    <div style="border:1px solid #111827;border-top:0;padding:4px 8px;">
      <strong style="font-size:11pt;">Amount Chargeable (in words)</strong>
      <span style="float:right;font-style:italic;font-size:10pt;">E. &amp; O.E</span>
      <div style="margin-top:3px;font-weight:400;font-size:11pt;">${escapeHtml(amountWords)}</div>
    </div>

    <div style="border:1px solid #111827;border-top:0;">
      <div style="display:flex;">
        <div style="width:55%;padding:10px;border-right:1px solid #111827;">
          <div style="font-weight:700;margin-bottom:3px;font-size:11pt;">Company's Bank Details</div>
          <div style="font-size:11pt;line-height:1.7;">
            <div style="display:flex;">
              <span style="width:80px;font-weight:bold;">Bank Name</span>
              <span>: ${escapeHtml(settings.bankName || invoice.bankName || '')}</span>
            </div>
            <div style="display:flex;">
              <span style="width:80px;font-weight:bold;">A/c No.</span>
              <span>: ${escapeHtml(settings.accountNumber || invoice.accountNumber || '')}</span>
            </div>
            <div style="display:flex;">
              <span style="width:80px;font-weight:bold;">IFS Code</span>
              <span>: ${escapeHtml(settings.branchIfsc || invoice.branchIfsc || '')}</span>
            </div>
          </div>
          <div style="margin-top:10px;font-weight:700;font-size:11pt;">Declaration</div>
          <div style="font-size:11pt;line-height:1.5;">
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
        </div>
        <div style="width:45%;padding:10px;text-align:right;">
          <div style="font-size:11pt;">for ${escapeHtml(settings.companyName)}</div>
          <div style="margin-top:80px;font-weight:700;font-size:11pt;">Authorised Signatory</div>
        </div>
      </div>
    </div>

    <div class="invoice-note" style="border:1px solid #111827;border-top:0;">SUBJECT TO TIRUPPUR JURISDICTION</div>
    <div class="invoice-note" style="border:1px solid #111827;border-top:0;padding-bottom:4px;">This is a Computer Generated Invoice</div>
  `
}

// ─── NO-GST Invoice body builder — fully independent, mirrors GST layout exactly ─
function buildNoGstInvoiceBody(payload) {
  const invoice = payload.invoice || {}
  const settings = { ...settingsDefaults, ...(payload.settings || {}) }
  const items = Array.isArray(payload.items) ? payload.items : []
  const totals = payload.totals || {}

  // No-GST: use noGstAmountWords if provided, else fall back to amountWords
  const amountWords = totals.noGstAmountWords || invoice.amountWords || totals.amountWords || ''
  const taxableValue = Number(totals.taxableValue || 0)

  const buyerAddress =
    [invoice.buyerAddressLine1, invoice.buyerAddressLine2].filter(Boolean).join('<br/>') ||
    escapeHtml(invoice.buyerAddress || '')

  // No HSN/SAC column — col widths: Sl 5%, Desc 48%, Qty 12%, Rate 11%, Per 8%, Amt 16%
  const rows = items.map((item, index) => {
    const amount = Number(item.quantity || 0) * Number(item.rate || 0)
    return `
      <tr>
        <td style="width:5%;text-align:center;font-weight:400;">${index + 1}</td>
        <td style="width:48%;font-weight:400;">${escapeHtml(item.description || '')}</td>
        <td style="width:12%;text-align:right;font-weight:400;">${item.quantity ? Number(item.quantity).toLocaleString('en-IN') : ''}</td>
        <td style="width:11%;text-align:right;font-weight:400;">${item.rate ? Number(item.rate).toFixed(2) : ''}</td>
        <td style="width:8%;text-align:right;font-weight:400;">${escapeHtml(item.unit || '')}</td>
        <td style="width:16%;text-align:right;font-weight:400;">${amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
      </tr>
    `
  }).join('')

  return `
    <!-- ── Company header ── -->
    <div class="invoice-company-header">
      <div class="invoice-company-logo">
        ${settings.companyLogo
          ? `<img src="${settings.companyLogo}" alt="Logo" />`
          : `<div style="width:64px;height:64px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#aaa;text-align:center;">LOGO</div>`
        }
      </div>
      <div class="invoice-company-name-block">
        <div class="invoice-company">${escapeHtml(settings.companyName)}</div>
        <div class="invoice-small">State Name : ${escapeHtml(settings.stateName || '')}</div>
      </div>
      <div class="invoice-company-address-block">
        <div class="invoice-small">${escapeHtml(settings.address1 || '')}</div>
        ${settings.address2 ? `<div class="invoice-small">${escapeHtml(settings.address2)}</div>` : ''}
        <div class="invoice-small">${escapeHtml([settings.city, settings.pincode].filter(Boolean).join(' - '))}</div>
        <div class="invoice-small">E-Mail : ${escapeHtml(settings.email || '')}</div>
      </div>
    </div>

    <!-- ── Buyer + Invoice meta ── -->
    <div class="invoice-buyer-meta-row">
      <div class="invoice-buyer-col">
        <div style="font-weight:700;font-size:14pt;margin-bottom:4px;">Buyer (Bill to)</div>
        <div style="font-weight:700;font-size:12pt;margin-bottom:3px;">${escapeHtml(invoice.buyerName || '')}</div>
        <div class="invoice-small">${buyerAddress}</div>
        <div class="invoice-small">State Name : ${escapeHtml(invoice.buyerState || '')}</div>
      </div>
      <div class="invoice-meta-col">
        <div class="invoice-meta-row">
          <div class="invoice-label">Invoice No.</div>
          <div class="invoice-meta-value">${escapeHtml(invoice.invoiceNumber || '')}</div>
        </div>
        <div class="invoice-meta-row">
          <div class="invoice-label">Dated</div>
          <div class="invoice-meta-value">${escapeHtml(invoice.invoiceDate || '')}</div>
        </div>
        ${invoice.deliveryNote ? `<div class="invoice-meta-row"><div class="invoice-label">Delivery Note</div><div class="invoice-meta-value">${escapeHtml(invoice.deliveryNote)}</div></div>` : ''}
        ${invoice.paymentTerms ? `<div class="invoice-meta-row"><div class="invoice-label">Terms of Payment</div><div class="invoice-meta-value">${escapeHtml(invoice.paymentTerms)}</div></div>` : ''}
      </div>
    </div>

    <!-- ── Line items table ── -->
    <table class="invoice-table" style="border-top:1px solid #111827;">
      <colgroup>
        <col style="width:5%"/>
        <col style="width:48%"/>
        <col style="width:12%"/>
        <col style="width:11%"/>
        <col style="width:8%"/>
        <col style="width:16%"/>
      </colgroup>
      <thead>
        <tr>
          <th style="text-align:center;font-size:11pt;">Sl No.</th>
          <th style="font-size:11pt;">Description of Goods</th>
          <th style="text-align:right;font-size:11pt;">Quantity</th>
          <th style="text-align:right;font-size:11pt;">Rate</th>
          <th style="text-align:right;font-size:11pt;">per</th>
          <th style="text-align:right;font-size:11pt;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="6" style="padding:0;height:380px;vertical-align:top;border:0;">
            <!-- Column separator layer — always visible -->
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;height:100%;">
              <colgroup>
                <col style="width:5%"/>
                <col style="width:48%"/>
                <col style="width:12%"/>
                <col style="width:11%"/>
                <col style="width:8%"/>
                <col style="width:16%"/>
              </colgroup>
              <tbody>
                <tr style="height:100%;">
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="border-right:1px solid #111827;padding:0;vertical-align:top;"></td>
                  <td style="padding:0;vertical-align:top;"></td>
                </tr>
              </tbody>
            </table>
            <!-- Item rows overlaid -->
            <div style="position:relative;margin-top:-380px;pointer-events:none;">
              <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <colgroup>
                  <col style="width:5%"/>
                  <col style="width:48%"/>
                  <col style="width:12%"/>
                  <col style="width:11%"/>
                  <col style="width:8%"/>
                  <col style="width:16%"/>
                </colgroup>
                <tbody>
                  ${rows || ''}
                </tbody>
              </table>
            </div>
          </td>
        </tr>

        <!-- Total row — no CGST/SGST rows -->
        <tr>
          <td colspan="5" style="text-align:right;border-right:1px solid #111827;font-weight:700;font-size:12pt;">Total</td>
          <td style="text-align:right;font-weight:700;font-size:12pt;">&#8377; ${Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>

    <!-- Amount in words — no HSN block above this -->
    <div style="border:1px solid #111827;border-top:0;padding:4px 8px;">
      <strong style="font-size:11pt;">Amount Chargeable (in words)</strong>
      <span style="float:right;font-style:italic;font-size:10pt;">E. &amp; O.E</span>
      <div style="margin-top:3px;font-weight:400;font-size:11pt;">${escapeHtml(amountWords)}</div>
    </div>

    <!-- Bank details + signatory -->
    <div style="border:1px solid #111827;border-top:0;">
      <div style="display:flex;">
        <div style="width:55%;padding:10px;border-right:1px solid #111827;">
          <div style="font-weight:700;margin-bottom:3px;font-size:11pt;">Company's Bank Details</div>
          <div style="font-size:11pt;line-height:1.7;">
            <div style="display:flex;">
              <span style="width:80px;font-weight:bold;">Bank Name</span>
              <span>: ${escapeHtml(settings.bankName || invoice.bankName || '')}</span>
            </div>
            <div style="display:flex;">
              <span style="width:80px;font-weight:bold;">A/c No.</span>
              <span>: ${escapeHtml(settings.accountNumber || invoice.accountNumber || '')}</span>
            </div>
            <div style="display:flex;">
              <span style="width:80px;font-weight:bold;">IFS Code</span>
              <span>: ${escapeHtml(settings.branchIfsc || invoice.branchIfsc || '')}</span>
            </div>
          </div>
          <div style="margin-top:10px;font-weight:700;font-size:11pt;">Declaration</div>
          <div style="font-size:11pt;line-height:1.5;">
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
        </div>
        <div style="width:45%;padding:10px;text-align:right;">
          <div style="font-size:11pt;">for ${escapeHtml(settings.companyName)}</div>
          <div style="margin-top:80px;font-weight:700;font-size:11pt;">Authorised Signatory</div>
        </div>
      </div>
    </div>

    <div class="invoice-note" style="border:1px solid #111827;border-top:0;">SUBJECT TO TIRUPPUR JURISDICTION</div>
    <div class="invoice-note" style="border:1px solid #111827;border-top:0;padding-bottom:4px;">This is a Computer Generated Invoice</div>
  `
}

// ─── Full markup wrappers ─────────────────────────────────────────────────────
function buildInvoiceMarkup(payload) {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice</title>
      <style>${getInvoicePrintStyles()}</style>
    </head>
    <body>
      <div class="invoice-sheet">
        <div class="invoice-title">TAX INVOICE</div>
        ${buildInvoiceBody(payload, true)}
      </div>
    </body>
  </html>`
}

function buildNoGstInvoiceMarkup(payload) {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice</title>
      <style>${getNoGstPrintStyles()}</style>
    </head>
    <body>
      <div class="invoice-sheet">
        <div class="invoice-title">INVOICE</div>
        ${buildNoGstInvoiceBody(payload)}
      </div>
    </body>
  </html>`
}

function getPrintableInvoiceMarkup(payload) {
  const preview = document.getElementById('invoice-preview')
  if (preview) {
    return `<style>${getInvoicePrintStyles()}</style>${preview.outerHTML}`
  }
  return buildInvoiceMarkup(payload)
}

// ─── PDF download core ────────────────────────────────────────────────────────
async function _downloadPdfViaCanvas(fullHtmlMarkup, filename) {
  if (typeof window !== 'undefined' && window.electron) {
    await window.electron.invoke('app:exportPdf', { html: fullHtmlMarkup, filename })
    return
  }

  const A4_WIDTH_PT = 595.28
  const A4_HEIGHT_PT = 841.89
  const RENDER_WIDTH_PX = 794  // 210mm at 96dpi

  const styleMatch = fullHtmlMarkup.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  const styleText = styleMatch ? styleMatch[1] : ''

  const bodyMatch = fullHtmlMarkup.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyHtml = bodyMatch ? bodyMatch[1] : fullHtmlMarkup

  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-invoice-pdf', '1')
  styleEl.textContent = styleText
  document.head.appendChild(styleEl)

  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-invoice-pdf', '1')
  wrapper.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'width:' + RENDER_WIDTH_PX + 'px',
    'background:#fff',
    'z-index:-1',
    'transform:none',
    'zoom:1',
  ].join(';')
  wrapper.innerHTML = bodyHtml
  document.body.appendChild(wrapper)

  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)))

  const canvas = await html2canvas(wrapper, {
    useCORS: true,
    logging: false,
    width: RENDER_WIDTH_PX,
    windowWidth: RENDER_WIDTH_PX,
    scrollX: 0,
    scrollY: 0,
    backgroundColor: '#ffffff',
    imageTimeout: 0,
  })

  wrapper.remove()
  styleEl.remove()

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })

  const pxPerPt = canvas.width / A4_WIDTH_PT
  const pageHeightPx = Math.round(A4_HEIGHT_PT * pxPerPt)
  const totalHeightPx = canvas.height
  let yOffset = 0
  let pageIndex = 0

  while (yOffset < totalHeightPx) {
    if (pageIndex > 0) pdf.addPage()

    const sliceHeight = Math.min(pageHeightPx, totalHeightPx - yOffset)

    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = pageHeightPx
    const ctx = pageCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

    const imgData = pageCanvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT)

    yOffset += pageHeightPx
    pageIndex++
  }

  pdf.save(filename)
}

// ─── Public exports ───────────────────────────────────────────────────────────

/** Download with full GST details */
export async function downloadInvoicePdf(payload, filename = 'invoice.pdf') {
  const markup = getPrintableInvoiceMarkup(payload)
  const fullMarkup = markup.includes('<!DOCTYPE html>')
    ? markup
    : `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:0;background:#fff;}${getInvoicePrintStyles()}</style></head><body>${markup}</body></html>`
  await _downloadPdfViaCanvas(fullMarkup, filename)
}

/** Download No-GST invoice — dedicated independent layout, no GST/tax content */
export async function downloadInvoicePdfNoGst(payload, filename = `invoice-no-gst-${Date.now()}.pdf`) {
  const markup = buildNoGstInvoiceMarkup(payload)
  await _downloadPdfViaCanvas(markup, filename)
}

// ─── Print ────────────────────────────────────────────────────────────────────

function _print(markup) {
  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) return

  if (markup.includes('<!DOCTYPE html>')) {
    printWindow.document.write(markup)
  } else {
    printWindow.document.write(`<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice</title>
          <style>${getInvoicePrintStyles()}</style>
        </head>
        <body>${markup}</body>
      </html>`)
  }

  printWindow.document.close()
  printWindow.focus()
  printWindow.onload = () => printWindow.print()
}

/** Print with full GST details */
export function printInvoice(payload) {
  _print(getPrintableInvoiceMarkup(payload))
}

/** Print No-GST invoice — dedicated independent layout */
export function printInvoiceNoGst(payload) {
  _print(buildNoGstInvoiceMarkup(payload))
}