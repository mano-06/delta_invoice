import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const COPY_LABELS = ['(ORIGINAL FOR SUPPLIER)', '(DUPLICATE FOR RECIPIENT)', '(TRIPLICATE FOR SUPPLIER)', '(EXTRA COPY)']

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
  bankName: '',
  accountNumber: '',
  branchIfsc: '',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Shared print styles (font import + page setup only) ─────────────────────
function getInvoicePrintStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;500;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #fff;
      font-family: 'Jost', 'Futura PT', 'Futura', sans-serif;
      font-size: 9px;
      color: #000;
      font-weight: 500;
      font-synthesis: none;
      letter-spacing: -0.015em;
    }
    .invoice-sheet {
      font-family: 'Jost', 'Futura PT', 'Futura', sans-serif;
      font-size: 9px;
      color: #000;
      font-weight: 500;
      font-synthesis: none;
      letter-spacing: -0.015em;
      width: 210mm;
      min-height: 257mm;
      margin: 0 auto;
      padding: 0mm 6mm;
      box-sizing: border-box;
      background-color: #fff;
    }
    @page {
      margin: 0;
      size: A4 portrait;
    }
    @media print {
      body { background: #fff; margin: 0; }
      .invoice-sheet {
        width: 210mm;
        min-height: 257mm;
        padding: 0mm 6mm;
        margin: 0;
        border: none;
        page-break-after: always;
      }
      * {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `
}

// ─── Build one invoice sheet body (mirrors InvoicePreview JSX exactly) ────────
function buildInvoiceBody(payload, copyLabel = '') {
  const invoice = payload.invoice || {}
  const settings = { ...settingsDefaults, ...(payload.settings || {}) }
  const items = Array.isArray(payload.items) ? payload.items : []
  const totals = payload.totals || {}

  const taxableValue = Number(totals.taxableValue || 0)
  const cgstAmount = Number(totals.cgstAmount || 0)
  const sgstAmount = Number(totals.sgstAmount || 0)
  const roundOff = Number(totals.roundOff || 0)
  const finalAmount = Number(totals.finalAmount || totals.totalAmount || 0)
  const totalQuantity = Number(totals.totalQuantity || 0)
  const amountWords = invoice.amountWords || totals.amountWords || ''
  const taxAmountWords = totals.taxAmountWords || ''

  const buyerAddressLine1 = escapeHtml(invoice.buyerAddressLine1 || invoice.buyerAddress?.split('\n')[0] || '')
  const buyerAddressLine2 = escapeHtml(invoice.buyerAddressLine2 || invoice.buyerAddress?.split('\n')[1] || '')

  // ── Item rows ──
  const itemRows = items.map((item, index) => {
    const amount = Number(item.quantity || 0) * Number(item.rate || 0)
    return `
      <tr>
        <td style="padding:3px 5px;font-size:13px;font-weight:500;text-align:center;vertical-align:top;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${index + 1}</td>
        <td style="padding:3px 5px;font-size:13px;font-weight:500;text-align:left;vertical-align:top;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.description || '')}</td>
        <td style="padding:3px 5px;font-size:13px;font-weight:500;text-align:center;vertical-align:top;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.hsn || '')}</td>
        <td style="padding:3px 5px;font-size:13px;font-weight:500;text-align:right;vertical-align:top;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.quantity ? `${Number(item.quantity).toLocaleString('en-IN')} Pcs` : ''}</td>
        <td style="padding:3px 5px;font-size:13px;font-weight:500;text-align:right;vertical-align:top;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.rate ? Number(item.rate).toFixed(2) : ''}</td>
        <td style="padding:3px 5px;font-size:13px;font-weight:500;text-align:center;vertical-align:top;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.unit || '')}</td>
        <td style="padding:3px 5px;font-size:13px;font-weight:500;text-align:right;vertical-align:top;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
      </tr>
    `
  }).join('')

  // ── HSN summary rows ──
  const hsnMap = {}
  items.forEach((item) => {
    const hsn = item.hsn || 'N/A'
    hsnMap[hsn] = (hsnMap[hsn] || 0) + Number(item.quantity || 0) * Number(item.rate || 0)
  })

  const hsnRows = Object.entries(hsnMap).map(([hsn, taxable]) => {
    const cgst = Number((taxable * 0.025).toFixed(2))
    const sgst = Number((taxable * 0.025).toFixed(2))
    return `
      <tr style="border-bottom:1px solid #000;">
        <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:left;border-right:1px solid #000;">${escapeHtml(hsn)}</td>
        <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">${Number(taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">2.50%</td>
        <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">${Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">2.50%</td>
        <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">${Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;">${Number(cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
  }).join('')

  const roundOffRow =  `
    <tr>
      <td colspan="6" style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;">ROUND OFF</td>
      <td style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;border-left:1px solid #000;">
        ${roundOff < 0 ? '(-)' : '(+)'}${Math.abs(roundOff).toFixed(2)}
      </td>
    </tr>
  `

  const colGroupHtml = `
    <colgroup>
      <col style="width:6%"/>
      <col style="width:37%"/>
      <col style="width:10%"/>
      <col style="width:12%"/>
      <col style="width:10%"/>
      <col style="width:8%"/>
      <col style="width:16%"/>
    </colgroup>
  `

  return `
    <!-- Copy label sits OUTSIDE and above the invoice sheet, aligned right -->
    ${copyLabel ? `<div style="padding:4mm 6mm 0mm;width:210mm;margin:0 auto;display:flex;justify-content:flex-end;padding-bottom:3px;"><span style="font-size:10px;font-weight:400;letter-spacing:0.5px;background:#fff;">${escapeHtml(copyLabel)}</span></div>` : ''}

    <div class="invoice-sheet">

      <!-- ── Company header ── -->
      <div style="display:flex;border:1px solid #000;border-bottom:0;align-items:stretch;min-height:60px;">
        <div style="flex:1;width:72px;min-width:72px;padding:4px;display:flex;align-items:center;justify-content:left;">
          ${settings.companyLogo
            ? `<img src="${settings.companyLogo}" alt="Logo" style="max-width:225px;max-height:180px;object-fit:contain;margin:15px 15px 15px 15px;" />`
            : `<div style="width:60px;height:60px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:8px;color:#aaa;text-align:center;">LOGO</div>`
          }
        </div>
        <div style="width:38%;padding:10px 10px 4px;text-align:left;font-size:13px;line-height:1.4;">
          ${settings.address1 ? `<div>${escapeHtml(settings.address1)}</div>` : ''}
          ${settings.address2 ? `<div>${escapeHtml(settings.address2)}</div>` : ''}
          ${(settings.city || settings.pincode) ? `<div>${escapeHtml([settings.city, settings.pincode].filter(Boolean).join(' - '))}</div>` : ''}
          ${settings.stateName ? `<div>State Name : ${escapeHtml(settings.stateName)}</div>` : ''}
          ${settings.email ? `<div>E-Mail : ${escapeHtml(settings.email)}</div>` : ''}
          ${settings.gstin ? `<div style="font-size:14px;">GSTIN/UIN : ${escapeHtml(settings.gstin)}</div>` : ''}
        </div>
      </div>

      <!-- ── Buyer + Invoice meta ── -->
      <div style="display:flex;border:1px solid #000;border-bottom:0;min-height:107px;">
        <div style="display:flex;flex-direction:column;width:55%;padding:4px 8px;border-right:1px solid #000;line-height:1.4;">
          <div style="flex:1;font-weight:bold;font-size:13px;margin-bottom:3px;">Buyer (Bill to)</div>
          <div style="font-weight:700;font-size:14px;">${escapeHtml(invoice.buyerName || '')}</div>
          <div style="font-size:13px;">${buyerAddressLine1}</div>
          ${buyerAddressLine2 ? `<div style="font-size:13px;">${buyerAddressLine2}</div>` : ''}
          ${invoice.buyerState ? `<div style="font-size:13px;">State Name : ${escapeHtml(invoice.buyerState)}</div>` : ''}
          ${invoice.buyerGstin ? `<div style="font-size:14px;">GSTIN/UIN : ${escapeHtml(invoice.buyerGstin)}</div>` : ''}
        </div>
        <div style="width:45%;display:flex;flex-direction:column;">
          <div style="flex:1;padding:4px 6px;font-weight:bold;font-size:20px;text-align:center;margin-bottom:3px;margin-top:9px;vertical-align:middle;">TAX INVOICE</div>
          <div style="display:grid;grid-template-columns:46% 54%;border-bottom:1px solid #000;border-top:1px solid #000;">
            <div style="padding:8px 6px;font-weight:bold;font-size:13px;border-right:1px solid #000;">INVOICE NO.</div>
            <div style="padding:8px 6px;font-weight:bold;font-size:13px;">DATED</div>
          </div>
          <div style="display:grid;grid-template-columns:46% 54%;">
            <div style="padding:8px 6px;font-size:13px;border-right:1px solid #000;font-weight:500;">${escapeHtml(invoice.invoiceNumber || '')}</div>
            <div style="padding:8px 6px;font-size:13px;font-weight:500;">${escapeHtml(invoice.invoiceDate || '')}</div>
          </div>
        </div>
      </div>

      <!-- ── Line items table ── -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #000;table-layout:fixed;">
        ${colGroupHtml}
        <thead>
          <tr style="border-bottom:1px solid #000;">
            <th style="padding:4px 5px;font-weight:bold;font-size:13px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;white-space:nowrap;">Sl No.</th>
            <th style="padding:4px 5px;font-weight:bold;font-size:13px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;white-space:nowrap;">Description of Goods</th>
            <th style="padding:4px 5px;font-weight:bold;font-size:13px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;white-space:nowrap;">HSN/SAC</th>
            <th style="padding:4px 5px;font-weight:bold;font-size:13px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;white-space:nowrap;">Quantity</th>
            <th style="padding:4px 5px;font-weight:bold;font-size:13px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;white-space:nowrap;">Rate</th>
            <th style="padding:4px 5px;font-weight:bold;font-size:13px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;white-space:nowrap;">Per</th>
            <th style="padding:4px 5px;font-weight:bold;font-size:13px;text-align:center;border-bottom:1px solid #000;white-space:nowrap;">Amount</th>
          </tr>
        </thead>
        <tbody>

          <!-- Fixed-height body with column separators -->
          <tr>
            <td colspan="7" style="padding:0;height:396px;vertical-align:top;border:0;position:relative;line-height:1;">
              <!-- Column separator layer -->
              <table style="position:absolute;top:0;left:0;width:100%;height:100%;border-collapse:collapse;table-layout:fixed;">
                ${colGroupHtml}
                <tbody>
                  <tr style="height:396px;">
                    <td style="border-right:1px solid #000;padding:0;"></td>
                    <td style="border-right:1px solid #000;padding:0;"></td>
                    <td style="border-right:1px solid #000;padding:0;"></td>
                    <td style="border-right:1px solid #000;padding:0;"></td>
                    <td style="border-right:1px solid #000;padding:0;"></td>
                    <td style="border-right:1px solid #000;padding:0;"></td>
                    <td style="padding:0;"></td>
                  </tr>
                </tbody>
              </table>
              <!-- Item rows -->
              <div style="position:relative;overflow:hidden;height:396px;">
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                  ${colGroupHtml}
                  <tbody>
                    ${itemRows}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Taxable subtotal -->
          <tr style="border-top:1px solid #000;">
            <td colspan="6" style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;"></td>
            <td style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;border-left:1px solid #000;">
              ${Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
          <tr>
            <td colspan="6" style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;">CGST 2.5%</td>
            <td style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;border-left:1px solid #000;">
              ${Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
          <tr>
            <td colspan="6" style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;">SGST 2.5%</td>
            <td style="padding:2px 5px;text-align:right;font-weight:500;font-size:13px;border-left:1px solid #000;">
              ${Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
          ${roundOffRow}

          <!-- Grand total -->
          <tr style="border-top:1px solid #000;">
            <td colspan="3" style="border-right:1px solid #000;text-align:right;padding:3px 5px;font-weight:bold;font-size:13px;">Total</td>
            <td style="padding:3px 5px;text-align:right;font-weight:bold;font-size:13px;">
              ${totalQuantity ? `${Number(totalQuantity).toLocaleString('en-IN')} Pcs` : ''}
            </td>
            <td colspan="2" style="padding:3px 5px;"></td>
            <td style="padding:3px 5px;text-align:right;font-weight:700;font-size:13px;border-left:1px solid #000;">
              Rs. ${Number(finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>

          <!-- Amount in words -->
          <tr style="border-top:1px solid #000;">
            <td colspan="7" style="padding:4px 8px;line-height:1;">
              <span style="font-weight:bold;font-size:13px;">Amount Chargeable (in words)</span>
              <span style="float:right;font-size:13px;">E. &amp; O.E</span>
              <div style="margin-top:3px;font-weight:500;font-size:13px;">${escapeHtml(amountWords)}</div>
            </td>
          </tr>

          <!-- HSN/SAC GST summary -->
          <tr style="border-top:1px solid #000;line-height:1;">
            <td colspan="7" style="padding:0;">
              <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <colgroup>
                  <col style="width:14%"/>
                  <col style="width:18%"/>
                  <col style="width:9%"/>
                  <col style="width:14%"/>
                  <col style="width:9%"/>
                  <col style="width:14%"/>
                  <col style="width:22%"/>
                </colgroup>
                <thead>
                  <tr>
                    <th rowspan="2" style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:left;border-right:1px solid #000;border-bottom:1px solid #000;">HSN/SAC</th>
                    <th rowspan="2" style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:right;border-right:1px solid #000;border-bottom:1px solid #000;">Taxable Value</th>
                    <th colspan="2" style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;">Central Tax</th>
                    <th colspan="2" style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:center;border-right:1px solid #000;border-bottom:1px solid #000;">State Tax</th>
                    <th rowspan="2" style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:right;border-bottom:1px solid #000;">Total Tax Amount</th>
                  </tr>
                  <tr>
                    <th style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:right;border-right:1px solid #000;border-bottom:1px solid #000;">Rate</th>
                    <th style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:right;border-right:1px solid #000;border-bottom:1px solid #000;">Amount</th>
                    <th style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:right;border-right:1px solid #000;border-bottom:1px solid #000;">Rate</th>
                    <th style="padding:2px 5px;font-weight:bold;font-size:12px;text-align:right;border-right:1px solid #000;border-bottom:1px solid #000;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${hsnRows}
                  <tr style="border-top:1px solid #000;">
                    <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:left;border-right:1px solid #000;">Total</td>
                    <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">${Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="padding:2px 5px;border-right:1px solid #000;"></td>
                    <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">${Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="padding:2px 5px;border-right:1px solid #000;"></td>
                    <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;border-right:1px solid #000;">${Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="padding:2px 5px;font-size:12px;font-weight:500;text-align:right;">${Number(cgstAmount + sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Tax amount in words -->
          <tr style="border-top:1px solid #000;">
            <td colspan="7" style="padding:3px 8px;font-size:13px;font-weight:500;">
              <strong>Tax Amount (in words) :</strong> ${escapeHtml(taxAmountWords)}
            </td>
          </tr>

          <!-- Bank + Signatory -->
          <tr style="border-top:1px solid #000;">
            <td colspan="7" style="padding:0;">
              <div style="display:flex;">
                <div style="width:55%;padding:4px 8px;border-right:1px solid #000;">
                  <div style="font-weight:bold;font-size:13px;margin-bottom:6px;margin-top:6px;">Company's Bank Details</div>
                  <div style="font-size:13px;line-height:1.5;">
                    <div style="display:flex;">
                      <span style="width:80px;font-weight:bold;">Bank Name</span>
                      <span style="font-weight:500;">: ${escapeHtml(settings.bankName || '')}</span>
                    </div>
                    <div style="display:flex;">
                      <span style="width:80px;font-weight:bold;">A/c No.</span>
                      <span style="font-weight:500;">: ${escapeHtml(settings.accountNumber || '')}</span>
                    </div>
                    <div style="display:flex;">
                      <span style="width:80px;font-weight:bold;">IFS Code</span>
                      <span style="font-weight:500;">: ${escapeHtml(settings.branchIfsc || '')}</span>
                    </div>
                  </div>
                </div>
                <div style="width:45%;padding:4px 8px;text-align:right;">
                  <div style="font-size:14px;font-weight:700;margin-top:15px;">for ${escapeHtml(settings.companyName)}</div>
                  <div style="margin-top:40px;font-weight:bold;font-size:13px;">Authorised Signatory</div>
                </div>
              </div>
            </td>
          </tr>

        </tbody>
      </table>
        <div style="padding:2px 5px 4px;text-align:center;margin-top:2px;">
          <div style="text-transform:uppercase;font-size:13px;font-weight:bold;">SUBJECT TO TIRUPPUR JURISDICTION</div>
          <div style="margin-top:2px;font-size:13px;font-weight:500;">This is a Computer Generated Invoice</div>
        </div>
    </div>
  `
}

// ─── Build full HTML document with all 4 copies ───────────────────────────────
function buildAllCopiesMarkup(payload) {
  const sheets = COPY_LABELS.map((label) => buildInvoiceBody(payload, label)).join('')
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice</title>
      <style>${getInvoicePrintStyles()}</style>
    </head>
    <body>${sheets}</body>
  </html>`
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

/**
 * Download a 4-page PDF — Original, Duplicate, Triplicate, Quadruplicate.
 * Layout exactly matches the InvoicePreview on-screen component.
 */
export async function downloadInvoicePdf(payload, filename = 'invoice.pdf') {
  await _downloadPdfViaCanvas(buildAllCopiesMarkup(payload), filename)
}

/**
 * Print all 4 copies in a single print dialog (one copy per A4 page).
 * Layout exactly matches the InvoicePreview on-screen component.
 */
export function printInvoice(payload) {
  const markup = buildAllCopiesMarkup(payload)
  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) return
  printWindow.document.write(markup)
  printWindow.document.close()
  printWindow.focus()
  printWindow.onload = () => printWindow.print()
}