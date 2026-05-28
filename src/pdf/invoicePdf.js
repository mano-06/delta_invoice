import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const settingsDefaults = {
  companyName: 'EXTREME EMBROIDERIES',
  address1: '',
  address2: '',
  city: '',
  pincode: '',
  gstin: '',
  stateName: '',
  email: '',
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

// ─── GST Invoice styles (unchanged) ──────────────────────────────────────────
function getInvoicePrintStyles() {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.35;
    }
    .invoice-sheet {
      width: 210mm;
      min-height: 296mm;
      padding: 12mm 12mm 10mm 12mm;
      margin: 0 auto;
      background: #ffffff;
      color: #111827;
      border: 1px solid #111827;
      border-radius: 0;
      box-shadow: none;
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.35;
      box-sizing: border-box;
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
      font-size: 13pt;
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
      border: 2px solid #111827;
      padding: 6px 8px;
      vertical-align: top;
      font-size: 9pt;
      font-weight: 400;
    }
    .invoice-table thead th { border-top: 2px solid #111827; }

    .invoice-grid-wrapper {
      border-top: 2px solid #111827;
      border-left: 2px solid #111827;
      border-right: 2px solid #111827;
    }
    .invoice-grid {
      display: flex;
      gap: 0;
    }
    .invoice-grid > div {
      width: 50%;
    }
    .company-block,
    .buyer-block,
    .footer-block,
    .summary-block {
      background: #ffffff;
      font-weight: 400;
    }
    .company-block {
      border-right: 2px solid #111827;
      padding: 8px;
    }
    .invoice-meta-grid {
      display: grid;
      grid-template-columns: 1fr;
      height: 100%;
    }
    .invoice-meta-row {
      display: grid;
      grid-template-columns: 45% 55%;
      border-bottom: 2px solid #111827;
    }
    .invoice-meta-row:last-child {
      border-bottom: 0;
    }
    .invoice-label {
      font-weight: 700;
      padding: 6px 8px;
      border-right: 2px solid #111827;
    }
    .invoice-meta-value {
      padding: 6px 8px;
      font-weight: 400;
    }
    .buyer-block {
      padding: 8px;
      min-height: 120px;
    }
    .company-block {
      padding: 8px;
    }
    .invoice-company {
      font-weight: 700;
      font-size: 11pt;
      text-transform: uppercase;
      margin-bottom: 4px;
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
      font-size: 9pt;
      letter-spacing: 1px;
      padding: 6px 0 0;
    }
    .invoice-small {
      font-size: 9pt;
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
        border: 1px solid #111827;
        page-break-inside: avoid;
      }
      * {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `
}

// ─── NO-GST Invoice styles (separate, clean 1px borders, larger font) ─────────
function getNoGstPrintStyles() {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
    }
    .nogst-sheet {
      width: 210mm;
      height: 297mm;
      padding: 8mm 10mm 8mm 10mm;
      margin: 0 auto;
      background: #fff;
      color: #000;
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }
    .nogst-title {
      text-align: center;
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: 3px;
      margin-bottom: 5px;
    }
    /* Outer wrapper — single 1px border around the whole invoice */
    .nogst-outer {
      border: 1px solid #000;
      display: flex;
      flex-direction: column;
    }
    /* Header row: company left | meta right */
    .nogst-header {
      display: flex;
      border-bottom: 1px solid #000;
    }
    .nogst-company {
      width: 52%;
      padding: 8px 10px;
      border-right: 1px solid #000;
    }
    .nogst-company-name {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .nogst-company-info {
      font-size: 10pt;
      line-height: 1.6;
    }
    .nogst-meta {
      width: 48%;
      display: flex;
      flex-direction: column;
    }
    .nogst-meta-row {
      display: flex;
      border-bottom: 1px solid #000;
    }
    .nogst-meta-row:last-child {
      border-bottom: 0;
      flex: 1;
    }
    .nogst-meta-label {
      width: 42%;
      padding: 6px 8px;
      font-size: 11pt;
      font-weight: 700;
      border-right: 1px solid #000;
    }
    .nogst-meta-value {
      width: 58%;
      padding: 6px 8px;
      font-size: 11pt;
      font-weight: 700;
    }
    .nogst-buyer {
      flex: 1;
      padding: 7px 10px;
    }
    .nogst-buyer-label {
      font-size: 11pt;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .nogst-buyer-name {
      font-size: 13pt;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .nogst-buyer-info {
      font-size: 10.5pt;
      line-height: 1.55;
    }
    /* Items table area — single unified table, no split header/body trick */
    .nogst-items-section {
      display: flex;
      flex-direction: column;
      border-top: 1px solid #000;
    }
    .nogst-items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    /* Header row — single bottom border only, no top border (outer section provides it) */
    .nogst-items-table thead th {
      font-size: 10.5pt;
      font-weight: 700;
      padding: 5px 7px;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      border-top: none;
      text-align: right;
      white-space: nowrap;
    }
    .nogst-items-table thead th:first-child { text-align: center; }
    .nogst-items-table thead th:nth-child(2) { text-align: left; }
    .nogst-items-table thead th:last-child { border-right: none; }
    /* Fixed-height items body — sized to hold ~30 rows */
    .nogst-items-body {
      height: 500px;
      overflow: hidden;
    }
    .nogst-items-body table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .nogst-items-body td {
      font-size: 10.5pt;
      font-weight: 700;
      padding: 4px 7px;
      border-right: 1px solid #000;
      text-align: right;
      vertical-align: top;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nogst-items-body td:first-child { text-align: center; }
    .nogst-items-body td:nth-child(2) { text-align: left; }
    .nogst-items-body td:last-child { border-right: none; }
    /* Total row */
    .nogst-total-row {
      display: flex;
      border-top: 1px solid #000;
      align-items: stretch;
    }
    .nogst-total-label {
      flex: 1;
      padding: 5px 8px;
      font-size: 11pt;
      font-weight: 700;
      text-align: right;
      border-right: 1px solid #000;
    }
    .nogst-total-amount {
      width: 21%;
      padding: 5px 8px;
      font-size: 11pt;
      font-weight: 700;
      text-align: right;
    }
    /* Amount in words */
    .nogst-words-row {
      border-top: 1px solid #000;
      padding: 5px 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .nogst-words-label {
      font-size: 11pt;
      font-weight: 700;
    }
    .nogst-words-value {
      font-size: 11pt;
      font-weight: 400;
      margin-top: 3px;
    }
    .nogst-eoe {
      font-size: 10pt;
      font-style: italic;
      font-weight: 700;
    }
    /* Bank + signatory footer */
    .nogst-footer {
      display: flex;
      border-top: 1px solid #000;
    }
    .nogst-bank {
      width: 55%;
      padding: 8px 10px;
      border-right: 1px solid #000;
    }
    .nogst-bank-title {
      font-size: 11pt;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .nogst-bank-row {
      display: flex;
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.7;
    }
    .nogst-bank-key {
      width: 90px;
    }
    .nogst-declaration-title {
      font-size: 10.5pt;
      font-weight: 600;
      margin-top: 8px;
      margin-bottom: 2px;
    }
    .nogst-declaration-text {
      font-size: 10pt;
      font-weight: 400;
      line-height: 1.5;
    }
    .nogst-signatory {
      width: 45%;
      padding: 8px 10px;
      text-align: right;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .nogst-for {
      font-size: 10.5pt;
      font-weight: 400;
    }
    .nogst-auth {
      font-size: 11pt;
      font-weight: 400;
    }
    /* Bottom notes */
    .nogst-jurisdiction {
      border-top: 1px solid #000;
      text-align: center;
      font-size: 10.5pt;
      font-weight: 500;
      letter-spacing: 1px;
      padding: 4px 0;
      text-transform: uppercase;
    }
    .nogst-generated {
      text-align: center;
      font-size: 10pt;
      font-weight: 400;
      padding: 3px 0 4px;
    }
    @page {
      margin: 0;
      size: A4 portrait;
    }
    @media print {
      body { margin: 0; background: #fff; }
      .nogst-sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 8mm 10mm 8mm 10mm;
        margin: 0;
      }
      * {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `
}

// ─── No-GST HTML body builder ─────────────────────────────────────────────────
function buildNoGstInvoiceBody(payload) {
  const invoice = payload.invoice || {}
  const settings = { ...settingsDefaults, ...(payload.settings || {}) }
  const items = Array.isArray(payload.items) ? payload.items : []
  const totals = payload.totals || {}

  const amountWords = invoice.amountWords || totals.amountWords || ''
  // No-GST total is purely taxableValue (sum of qty × rate, no CGST/SGST)
  const taxableValue = Number(totals.taxableValue || 0)
  // Use dedicated no-GST amount words passed from the caller (taxableValue-based).
  // Falls back to amountWords only if finalAmount ≈ taxableValue (no tax was applied).
  const noGstAmountWords = totals.noGstAmountWords ||
    (Math.abs(Number(totals.finalAmount || 0) - taxableValue) < 1 ? amountWords : amountWords)

  // Address: handle both flat buyerAddress string and line1/line2 split
  const buyerAddressHtml =
    [invoice.buyerAddressLine1, invoice.buyerAddressLine2].filter(Boolean).join('<br/>') ||
    escapeHtml(invoice.buyerAddress || '')

  // Item rows — col widths: Sl 8%, Desc 47%, Qty 13%, Rate 13%, Per 8%, Amt 11%
  const itemRows = items.map((item, index) => {
    const amount = Number(item.quantity || 0) * Number(item.rate || 0)
    return `
      <tr>
        <td style="width:8%;">${index + 1}</td>
        <td style="width:47%;">${escapeHtml(item.description || '')}</td>
        <td style="width:13%;">${item.quantity ? Number(item.quantity).toLocaleString('en-IN') : ''}</td>
        <td style="width:13%;">${item.rate ? Number(item.rate).toFixed(2) : ''}</td>
        <td style="width:8%;">${escapeHtml(item.unit || '')}</td>
        <td style="width:11%;border-right:none;">${amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
      </tr>
    `
  }).join('')

  const companyInfoLines = [
    settings.address1,
    settings.address2,
    [settings.city, settings.pincode].filter(Boolean).join(' - '),
    settings.stateName ? `State Name : ${settings.stateName}` : '',
    settings.email ? `E-Mail : ${settings.email}` : '',
  ].filter(Boolean).map(l => `<div>${escapeHtml(l)}</div>`).join('')

  return `
    <div class="nogst-title">INVOICE</div>
    <div class="nogst-outer">

      <!-- Header: company + meta -->
      <div class="nogst-header">
        <div class="nogst-company">
          <div class="nogst-company-name">${escapeHtml(settings.companyName)}</div>
          <div class="nogst-company-info">${companyInfoLines}</div>
        </div>
        <div class="nogst-meta">
          <div class="nogst-meta-row">
            <div class="nogst-meta-label">Invoice No.</div>
            <div class="nogst-meta-value">${escapeHtml(invoice.invoiceNumber || '')}</div>
          </div>
          <div class="nogst-meta-row">
            <div class="nogst-meta-label">Dated</div>
            <div class="nogst-meta-value">${escapeHtml(invoice.invoiceDate || '')}</div>
          </div>
          <div class="nogst-meta-row">
            <div class="nogst-buyer">
              <div class="nogst-buyer-label">Buyer (Bill to)</div>
              <div class="nogst-buyer-name">${escapeHtml(invoice.buyerName || '')}</div>
              <div class="nogst-buyer-info">${buyerAddressHtml}</div>
              ${invoice.buyerState ? `<div class="nogst-buyer-info">State Name : ${escapeHtml(invoice.buyerState)}</div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Items section -->
      <div class="nogst-items-section">
        <!-- Column headers -->
        <table class="nogst-items-table">
          <colgroup>
            <col style="width:8%"/>
            <col style="width:47%"/>
            <col style="width:13%"/>
            <col style="width:13%"/>
            <col style="width:8%"/>
            <col style="width:11%"/>
          </colgroup>
          <thead>
            <tr>
              <th>Sl No.</th>
              <th style="text-align:left;">Description of Goods</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>per</th>
              <th style="border-right:none;">Amount</th>
            </tr>
          </thead>
        </table>

        <!-- Fixed-height items body (~30 rows @ ~12.3px each = 370px) -->
        <div class="nogst-items-body">
          <table>
            <colgroup>
              <col style="width:8%"/>
              <col style="width:47%"/>
              <col style="width:13%"/>
              <col style="width:13%"/>
              <col style="width:8%"/>
              <col style="width:11%"/>
            </colgroup>
            <tbody>
              ${itemRows || '<tr><td colspan="6"></td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Total row -->
        <div class="nogst-total-row">
          <div class="nogst-total-label">Total</div>
          <div class="nogst-total-amount">&#8377; ${Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      <!-- Amount in words -->
      <div class="nogst-words-row">
        <div>
          <div class="nogst-words-label">Amount Chargeable (in words)</div>
          <div class="nogst-words-value">${escapeHtml(noGstAmountWords)}</div>
        </div>
        <div class="nogst-eoe">E. &amp; O.E</div>
      </div>

      <!-- Bank details + signatory -->
      <div class="nogst-footer">
        <div class="nogst-bank">
          <div class="nogst-bank-title">Company's Bank Details</div>
          <div class="nogst-bank-row"><span class="nogst-bank-key">Bank Name</span><span>: ${escapeHtml(settings.bankName || invoice.bankName || '')}</span></div>
          <div class="nogst-bank-row"><span class="nogst-bank-key">A/c No.</span><span>: ${escapeHtml(settings.accountNumber || invoice.accountNumber || '')}</span></div>
          <div class="nogst-bank-row"><span class="nogst-bank-key">IFS Code</span><span>: ${escapeHtml(settings.branchIfsc || invoice.branchIfsc || '')}</span></div>
          <div class="nogst-declaration-title">Declaration</div>
          <div class="nogst-declaration-text">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
        </div>
        <div class="nogst-signatory">
          <div class="nogst-for">for ${escapeHtml(settings.companyName)}</div>
          <div class="nogst-auth">Authorised Signatory</div>
        </div>
      </div>

      <!-- Footer notes -->
      <div class="nogst-jurisdiction">SUBJECT TO TIRUPPUR JURISDICTION</div>
      <div class="nogst-generated">This is a Computer Generated Invoice</div>

    </div>
  `
}

// ─── SHARED: header + items table builder (GST) ───────────────────────────────
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
    <div class="invoice-grid-wrapper">
      <div class="invoice-grid">
        <div class="company-block">
          <div class="invoice-company">${escapeHtml(settings.companyName)}</div>
          <div class="invoice-small">${escapeHtml(settings.address1 || '')}</div>
          <div class="invoice-small">${escapeHtml(settings.address2 || '')}</div>
          <div class="invoice-small">${escapeHtml([settings.city, settings.pincode].filter(Boolean).join(' - '))}</div>
          ${withGst ? `<div class="invoice-small">GSTIN/UIN : ${escapeHtml(settings.gstin || '')}</div>` : ''}
          <div class="invoice-small">State Name : ${escapeHtml(settings.stateName || '')}</div>
          <div class="invoice-small">E-Mail : ${escapeHtml(settings.email || '')}</div>
        </div>

        <div class="invoice-meta-grid">
          <div class="invoice-meta-row">
            <div class="invoice-label">Invoice No.</div>
            <div class="invoice-meta-value">${escapeHtml(invoice.invoiceNumber || '')}</div>
          </div>
          <div class="invoice-meta-row">
            <div class="invoice-label">Dated</div>
            <div class="invoice-meta-value">${escapeHtml(invoice.invoiceDate || '')}</div>
          </div>
          <div class="buyer-block">
            <div class="invoice-label" style="border-right:0;padding-left:0;">Buyer (Bill to)</div>
            <div style="margin-top:6px;font-weight:700;">${escapeHtml(invoice.buyerName || '')}</div>
            <div class="invoice-small" style="margin-top:3px;">${buyerAddress}</div>
            ${withGst ? `<div class="invoice-small" style="margin-top:3px;">GSTIN/UIN : ${escapeHtml(invoice.buyerGstin || '')}</div>` : ''}
            <div class="invoice-small">State Name : ${escapeHtml(invoice.buyerState || '')}</div>
          </div>
        </div>
      </div>
    </div>

    <table class="invoice-table" style="border-top:0;">
      <thead>
        <tr>
          <th style="width:5%;text-align:center;">Sl No.</th>
          <th style="width:${withGst ? '38%' : '48%'};">Description of Goods</th>
          ${withGst ? `<th style="width:10%;text-align:right;">HSN/SAC</th>` : ''}
          <th style="width:12%;text-align:right;">Quantity</th>
          <th style="width:11%;text-align:right;">Rate</th>
          <th style="width:8%;text-align:right;">per</th>
          <th style="width:${withGst ? '16%' : '21%'};text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="${withGst ? 7 : 6}">No items</td></tr>'}
        
        ${gstTotalsRows}
        <tr>
          <td colspan="${colspanLabel}" style="text-align:right;border-right:1px solid #111827;font-weight:700;">Total</td>
          <td style="text-align:right;font-weight:700;">₹ ${Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>

    ${hsnBlock}

    <div style="border:1px solid #111827;border-top:0;padding:4px 8px;">
      <strong style="font-size:9pt;">Amount Chargeable (in words)</strong>
      <span style="float:right;font-style:italic;font-size:9pt;">E. &amp; O.E</span>
      <div style="margin-top:3px;font-weight:400;font-size:9pt;">${escapeHtml(amountWords)}</div>
    </div>

    <div style="border:1px solid #111827;border-top:0;">
      <div style="display:flex;">
        <div style="width:55%;padding:10px;border-right:1px solid #111827;">
          <div style="font-weight:700;margin-bottom:3px;font-size:9pt;">Company's Bank Details</div>
          <div style="font-size:9pt;line-height:1.7;">
            <div style="display:flex;">
              <span style="width:70px;font-weight:bold;">Bank Name</span>
              <span>: ${escapeHtml(settings.bankName || invoice.bankName || '')}</span>
            </div>

            <div style="display:flex;">
              <span style="width:70px;font-weight:bold;">A/c No.</span>
              <span>: ${escapeHtml(settings.accountNumber || invoice.accountNumber || '')}</span>
            </div>

            <div style="display:flex;">
              <span style="width:70px;font-weight:bold;">IFS Code</span>
              <span>: ${escapeHtml(settings.branchIfsc || invoice.branchIfsc || '')}</span>
            </div>
          </div>
          <div style="margin-top:10px;font-weight:700;font-size:9pt;">Declaration</div>
          <div style="font-size:9pt;line-height:1.5;">
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
        </div>
        <div style="width:45%;padding:10px;text-align:right;">
          <div style="font-size:9pt;">for ${escapeHtml(settings.companyName)}</div>
          <div style="margin-top:80px;font-weight:700;font-size:9pt;">Authorised Signatory</div>
        </div>
      </div>
    </div>

    <div class="invoice-note" style="border:1px solid #111827;border-top:0;">SUBJECT TO TIRUPPUR JURISDICTION</div>
    <div class="invoice-note" style="border:1px solid #111827;border-top:0;padding-bottom:4px;">This is a Computer Generated Invoice</div>
  `
}

// ─── Full markup wrappers ─────────────────────────────────────────────────────
function buildInvoiceMarkup(payload, withGst = true) {
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
      <div class="nogst-sheet">
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
  return buildInvoiceMarkup(payload, true)
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

/** Download No-GST invoice — dedicated clean layout, full A4, ~30-item capacity */
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
  _print(getPrintableInvoiceMarkup(payload, true))
}

/** Print No-GST invoice — dedicated clean layout */
export function printInvoiceNoGst(payload) {
  _print(buildNoGstInvoiceMarkup(payload))
}