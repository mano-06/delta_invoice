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
  stateCode: '',
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
    .invoice-table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    .invoice-table th,
    .invoice-table td {
      border: 1px solid #111827;
      padding: 6px 8px;
      vertical-align: top;
      font-size: 10pt;
    }
    .invoice-table th {
      background: #f8fafc;
      font-weight: 700;
      text-align: left;
    }
    .invoice-info-box,
    .invoice-box {
      border: 1px solid #111827;
      background: #ffffff;
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

function buildInvoiceMarkup(payload) {
  const invoice = payload.invoice || {}
  const settings = { ...settingsDefaults, ...(payload.settings || {}) }
  const items = Array.isArray(payload.items) ? payload.items : []
  const totals = payload.totals || {}
  const amountWords = invoice.amountWords || totals.amountWords || ''

  const rows = items
    .map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.description || '')}</td>
        <td>${escapeHtml(item.hsn || '')}</td>
        <td>${escapeHtml(item.quantity ?? '')}</td>
        <td>${escapeHtml(item.rate ?? '')}</td>
        <td>${escapeHtml(item.unit || '')}</td>
        <td>${escapeHtml(item.amount ?? '')}</td>
      </tr>
    `)
    .join('')

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice</title>
      <style>
        ${getInvoicePrintStyles()}
      </style>
    </head>
    <body>
      <div class="invoice-page">
        <div class="invoice-title">Tax Invoice</div>
        <div class="invoice-grid">
          <div>
            <p class="invoice-company">${escapeHtml(settings.companyName)}</p>
            <p>${escapeHtml(getAddressLines(settings))}</p>
            <p>${escapeHtml(settings.city || '')}${settings.city && settings.pincode ? ' - ' : ''}${escapeHtml(settings.pincode || '')}</p>
            <p>GSTIN/UIN : ${escapeHtml(settings.gstin || '')}</p>
            <p>State Name : ${escapeHtml(settings.stateName || '')}${settings.stateName && settings.stateCode ? ', ' : ''}Code : ${escapeHtml(settings.stateCode || '')}</p>
            <p>E-Mail : ${escapeHtml(settings.email || '')}</p>
          </div>
          <div class="invoice-box">
            <div class="invoice-meta-grid">
              <div><div class="invoice-label">Invoice No.</div><div>${escapeHtml(invoice.invoiceNumber || '')}</div></div>
              <div><div class="invoice-label">Dated</div><div>${escapeHtml(invoice.invoiceDate || '')}</div></div>
              <div><div class="invoice-label">Delivery Note</div><div>${escapeHtml(invoice.deliveryNote || '')}</div></div>
              <div><div class="invoice-label">Mode/Terms of Payment</div><div>${escapeHtml(invoice.paymentTerms || '')}</div></div>
              <div><div class="invoice-label">Reference No. & Date</div><div>${escapeHtml(invoice.referenceNo || '')} ${escapeHtml(invoice.referenceDate || '')}</div></div>
              <div><div class="invoice-label">Buyer's Order No.</div><div>${escapeHtml(invoice.orderNo || '')}</div></div>
              <div><div class="invoice-label">Dated</div><div>${escapeHtml(invoice.orderDate || '')}</div></div>
              <div><div class="invoice-label">Dispatch Doc No.</div><div>${escapeHtml(invoice.dispatchDocNo || '')}</div></div>
              <div><div class="invoice-label">Delivery Note Date</div><div>${escapeHtml(invoice.dispatchDate || '')}</div></div>
              <div><div class="invoice-label">Dispatched through</div><div>${escapeHtml(invoice.transporter || '')}</div></div>
              <div><div class="invoice-label">Destination</div><div>${escapeHtml(invoice.destination || '')}</div></div>
              <div><div class="invoice-label">Terms of Delivery</div><div>${escapeHtml(invoice.termsOfDelivery || '')}</div></div>
            </div>
          </div>
        </div>

        <div class="invoice-box" style="margin-top: 12px;">
          <div class="invoice-label">Buyer (Bill to)</div>
          <div>${escapeHtml(invoice.buyerName || '')}</div>
          <div>${escapeHtml(invoice.buyerAddress || '')}</div>
          <div>GSTIN/UIN : ${escapeHtml(invoice.buyerGstin || '')}</div>
          <div>State : ${escapeHtml(invoice.buyerState || '')}${invoice.buyerState && invoice.buyerStateCode ? ', ' : ''}Code : ${escapeHtml(invoice.buyerStateCode || '')}</div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Sl No.</th>
              <th>Description of Goods</th>
              <th>HSN/SAC</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Per</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7">No items</td></tr>'}
          </tbody>
        </table>

        <div class="invoice-amounts">
          <div class="invoice-box">
            <div class="invoice-label">Amount Chargeable (in words)</div>
            <div style="margin-top: 8px;">${escapeHtml(amountWords)}</div>
          </div>
          <div class="invoice-box">
            <div class="invoice-summary-grid">
              <div><div class="invoice-label">Taxable Value</div><div>${escapeHtml(totals.taxableValue ?? '')}</div></div>
              <div><div class="invoice-label">Central Tax @2.5%</div><div>${escapeHtml(totals.cgstAmount ?? '')}</div></div>
              <div><div class="invoice-label">State Tax @2.5%</div><div>${escapeHtml(totals.sgstAmount ?? '')}</div></div>
              <div><div class="invoice-label">Total Tax Amount</div><div>${escapeHtml(Number(totals.cgstAmount || 0) + Number(totals.sgstAmount || 0))}</div></div>
            </div>
          </div>
        </div>

        <div class="invoice-footer">
          <div class="invoice-box">
            <div class="invoice-label">Declaration</div>
            <div class="invoice-small" style="margin-top: 8px;">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
          </div>
          <div class="invoice-box invoice-signature">
            <div>for ${escapeHtml(settings.companyName)}</div>
            <div class="invoice-signature-line"></div>
            <div style="margin-top: 6px;">Authorised Signatory</div>
          </div>
        </div>

        <div class="invoice-note">Subject to Tiruppur Jurisdiction</div>
        <div class="invoice-note" style="margin-top: 4px;">This is a Computer Generated Invoice</div>
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

async function captureInvoiceMarkup(payload, filename = 'invoice.pdf') {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-9999px'
  wrapper.style.top = '0'
  wrapper.style.width = '210mm'
  wrapper.style.background = '#ffffff'
  wrapper.innerHTML = getPrintableInvoiceMarkup(payload)
  document.body.appendChild(wrapper)

  const canvas = await html2canvas(wrapper, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 840,
    height: wrapper.scrollHeight,
  })

  wrapper.remove()

  return canvas
}

export async function downloadInvoicePdf(payload, filename = 'invoice.pdf') {
  const canvas = await captureInvoiceMarkup(payload)
  const imageData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imageProps = pdf.getImageProperties(imageData)
  const pdfHeight = (imageProps.height * pageWidth) / imageProps.width

  pdf.addImage(imageData, 'PNG', 0, 0, pageWidth, Math.min(pdfHeight, pageHeight))
  pdf.save(filename)
}

export function printInvoice(payload) {
  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) return

  const printableMarkup = getPrintableInvoiceMarkup(payload)

  if (printableMarkup.includes('<!DOCTYPE html>')) {
    printWindow.document.write(printableMarkup)
  } else {
    printWindow.document.write(`<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice</title>
          <style>${getInvoicePrintStyles()}</style>
        </head>
        <body>${printableMarkup}</body>
      </html>`)
  }

  printWindow.document.close()
  printWindow.focus()
  printWindow.onload = () => printWindow.print()
}
