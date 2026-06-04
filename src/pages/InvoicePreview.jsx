import { useContext, useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'
import { api } from '../services/api'
import { downloadInvoicePdf, printInvoice } from '../pdf/invoicePdf'
import { toIndianCurrency } from '../utils/format'

const splitBuyerAddress = (value = '') => {
  const lines = String(value || '').split(/\r?\n/).map((line) => line.trim())
  return {
    buyerAddressLine1: lines[0] || '',
    buyerAddressLine2: lines.slice(1).join(' ').trim(),
  }
}

const joinBuyerAddress = (line1 = '', line2 = '') => [line1.trim(), line2.trim()].filter(Boolean).join('\n')

function InvoicePreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useContext(AppContext)
  const [invoice, setInvoice] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { register, control, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      invoiceNumber: '',
      invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      deliveryNote: '',
      paymentTerms: 'Cash',
      referenceNo: '',
      referenceDate: new Date().toISOString().slice(0, 10),
      orderNo: '',
      orderDate: new Date().toISOString().slice(0, 10),
      dispatchDocNo: '',
      dispatchDate: new Date().toISOString().slice(0, 10),
      transporter: '',
      destination: '',
      termsOfDelivery: 'Within India',
      buyerName: '',
      buyerAddressLine1: '',
      buyerAddressLine2: '',
      buyerGstin: '',
      buyerState: '',
      bankName: settings?.bankName || '',
      accountNumber: settings?.accountNumber || '',
      branchIfsc: settings?.branchIfsc || '',
      items: [{ description: '', hsn: settings?.hsnSac || '', quantity: 1, rate: 0, unit: 'Pcs' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const formValues = watch()
  const items = watch('items')

  useEffect(() => {
    loadInvoice()
  }, [id])

  useEffect(() => {
    if (!invoice) return
    reset(mapInvoiceToForm(invoice))
  }, [invoice, reset])

  const mapInvoiceToForm = (record) => ({
    invoiceNumber: record.invoiceNumber || '',
    invoiceDate: record.invoiceDate || new Date().toISOString().slice(0, 10),
    deliveryNote: record.deliveryNote || '',
    paymentTerms: record.paymentTerms || 'Cash',
    referenceNo: record.referenceNo || '',
    referenceDate: record.referenceDate || new Date().toISOString().slice(0, 10),
    orderNo: record.orderNo || '',
    orderDate: record.orderDate || new Date().toISOString().slice(0, 10),
    dispatchDocNo: record.dispatchDocNo || '',
    dispatchDate: record.dispatchDate || new Date().toISOString().slice(0, 10),
    transporter: record.transporter || '',
    destination: record.destination || '',
    termsOfDelivery: record.termsOfDelivery || 'Within India',
    buyerName: record.buyerName || '',
    ...splitBuyerAddress(record.buyerAddress || ''),
    buyerGstin: record.buyerGstin || '',
    buyerState: record.buyerState || '',
    bankName: record.bankName || settings?.bankName || '',
    accountNumber: record.accountNumber || settings?.accountNumber || '',
    branchIfsc: record.branchIfsc || settings?.branchIfsc || '',
    items: Array.isArray(record.items) && record.items.length
      ? record.items.map((item) => ({
        description: item.description || '',
        hsn: item.hsn || '',
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
        unit: item.unit || 'Pcs',
      }))
      : [{ description: '', hsn: '', quantity: 1, rate: 0, unit: 'Pcs' }],
  })

  const totals = (() => {
    const safeItems = items || []
    const taxableValue = safeItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0)
    const taxAmount = safeItems.reduce((sum, item) => {
      const taxRate = Number(item.taxRate || 5)
      return sum + (Number(item.quantity || 0) * Number(item.rate || 0) * taxRate) / 100
    }, 0)
    const cgstAmount = Number((taxAmount / 2).toFixed(2))
    const sgstAmount = Number((taxAmount / 2).toFixed(2))
    const rawTotal = taxableValue + taxAmount
    const roundedTotal = Number(rawTotal.toFixed(0))
    const roundOff = Number((roundedTotal - rawTotal).toFixed(2))

    return {
      taxableValue,
      cgstAmount,
      sgstAmount,
      roundOff,
      totalQuantity: safeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      finalAmount: Number((rawTotal + roundOff).toFixed(2)),
    }
  })()

  const loadInvoice = async () => {
    const response = await api.getInvoiceById(Number(id))
    if (response?.success === false || !response) {
      toast.error('Invoice not found')
      return
    }
    setInvoice(response)
  }

  // ── Shared payload builder — used by both GST and no-GST downloads ──────────
  const buildPreviewInvoice = () => {
    const cgstAmt = totals.cgstAmount
    const sgstAmt = totals.sgstAmount
    return {
      settings: {
        companyName: settings?.companyName || '',
        address1: settings?.address1 || '',
        address2: settings?.address2 || '',
        city: settings?.city || '',
        pincode: settings?.pincode || '',
        gstin: settings?.gstin || '',
        stateName: settings?.stateName || '',
        email: settings?.email || '',
        bankName: settings?.bankName || '',
        accountNumber: settings?.accountNumber || '',
        branchIfsc: settings?.branchIfsc || '',
        companyLogo: settings?.companyLogo || '',
      },
      invoice: {
        invoiceNumber: formValues.invoiceNumber || invoice?.invoiceNumber || '',
        invoiceDate: formValues.invoiceDate || invoice?.invoiceDate || '',
        buyerName: formValues.buyerName || invoice?.buyerName || '',
        buyerAddress: joinBuyerAddress(formValues.buyerAddressLine1, formValues.buyerAddressLine2),
        buyerGstin: formValues.buyerGstin || invoice?.buyerGstin || '',
        buyerState: formValues.buyerState || invoice?.buyerState || '',
        amountWords: toIndianCurrency(totals.finalAmount),
      },
      items: (items || []).map((item) => ({
        description: item.description || '',
        hsn: item.hsn || '',
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
        unit: item.unit || 'Pcs',
        amount: Number(item.quantity || 0) * Number(item.rate || 0),
      })),
      totals: {
        taxableValue: totals.taxableValue,
        cgstAmount: cgstAmt,
        sgstAmount: sgstAmt,
        roundOff: totals.roundOff,
        totalAmount: totals.finalAmount,
        finalAmount: totals.finalAmount,
        totalQuantity: totals.totalQuantity,
        amountWords: toIndianCurrency(totals.finalAmount),
        // Required by invoicePdf.js for the "Tax Amount (in words)" line
        taxAmountWords: toIndianCurrency(cgstAmt + sgstAmt),
        // No-GST invoice: amount in words uses taxableValue only (no CGST/SGST)
        noGstAmountWords: toIndianCurrency(totals.taxableValue),
      },
    }
  }

  const onSave = async (data) => {
    if (!invoice) return
    setIsSaving(true)
    try {
      const payload = {
        ...data,
        id: invoice.id,
        buyerAddress: joinBuyerAddress(data.buyerAddressLine1, data.buyerAddressLine2),
        bankName: data.bankName || settings?.bankName || '',
        accountNumber: data.accountNumber || settings?.accountNumber || '',
        branchIfsc: data.branchIfsc || settings?.branchIfsc || '',
        taxableValue: totals.taxableValue,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        roundOff: totals.roundOff,
        totalAmount: totals.finalAmount,
        totalQuantity: totals.totalQuantity,
        amountWords: toIndianCurrency(totals.finalAmount),
        taxAmountWords: toIndianCurrency(totals.cgstAmount + totals.sgstAmount),
        items: (data.items || []).map((item, index) => ({
          description: item.description || '',
          hsn: item.hsn || '',
          quantity: Number(item.quantity || 0),
          rate: Number(item.rate || 0),
          unit: item.unit || 'Pcs',
          serial: index + 1,
          amount: Number(item.quantity || 0) * Number(item.rate || 0),
        })),
      }
      const response = await api.saveInvoice(payload)
      if (response?.success === false || !response) {
        toast.error('Unable to update invoice')
        return
      }
      setInvoice(response)
      setIsEditing(false)
      toast.success('Invoice updated')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (!invoice) return
    reset(mapInvoiceToForm(invoice))
    setIsEditing(false)
  }

  const invoiceFilename = (suffix = 'DD') => `${formValues.invoiceNumber || invoice?.invoiceNumber || 'invoice'}.pdf`;

  if (!invoice) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-card">
        Loading invoice preview…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Invoice Preview</h2>
          <p className="mt-1 text-sm text-slate-500">Review, print or download the A4 invoice, and edit the saved invoice when needed.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Edit / Save */}
          <button
            type="button"
            onClick={() => {
              if (!isEditing) { setIsEditing(true); return }
              handleSubmit(onSave)()
            }}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {isEditing ? (isSaving ? 'Saving…' : 'Save Changes') : 'Edit Invoice'}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}

          {/* ── GST PDF / Print ── */}
          <button
            type="button"
            onClick={() => downloadInvoicePdf(buildPreviewInvoice(), invoiceFilename())}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => printInvoice(buildPreviewInvoice())}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Print
          </button>

          {/* ── No-GST PDF / Print ── */}
          {/* <button
            type="button"
            onClick={() => downloadInvoicePdfNoGst(buildPreviewInvoice(), invoiceFilename('-no-gst'))}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Download PDF (No GST)
          </button>
          <button
            type="button"
            onClick={() => printInvoiceNoGst(buildPreviewInvoice())}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Print (No GST)
          </button> */}

          <button
            type="button"
            onClick={() => navigate('/invoice-history')}
            className="rounded-full bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to History
          </button>
        </div>
      </div>

      {isEditing && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Edit Invoice</h3>
              <p className="mt-1 text-sm text-slate-500">Update the invoice header, buyer details and line items, then save.</p>
            </div>

            <form onSubmit={handleSubmit(onSave)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Invoice Number
                  <input {...register('invoiceNumber')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Invoice Date
                  <input type="date" {...register('invoiceDate')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Buyer Name
                  <input {...register('buyerName')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Address Line 1
                  <input {...register('buyerAddressLine1')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Address Line 2
                  <input {...register('buyerAddressLine2')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Buyer GSTIN
                  <input {...register('buyerGstin')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Buyer State
                  <input {...register('buyerState')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-slate-900">Line Items</h4>
                  <button
                    type="button"
                    onClick={() => append({ description: '', hsn: settings?.hsnSac || '', quantity: 1, rate: 0, unit: 'Pcs' })}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Add Line Item
                  </button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_0.8fr_auto]">
                    <label className="text-sm font-medium text-slate-700">
                      Description
                      <input {...register(`items.${index}.description`)} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      HSN/SAC
                      <input {...register(`items.${index}.hsn`)} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Quantity
                      <input type="number" step="0.01" {...register(`items.${index}.quantity`, { valueAsNumber: true })} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Rate
                      <input type="number" step="0.01" {...register(`items.${index}.rate`, { valueAsNumber: true })} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Unit
                      <input {...register(`items.${index}.unit`)} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="self-end rounded-full bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* ── INVOICE PRINT PREVIEW (GST version — always visible) ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card overflow-x-auto">
        <div
          id="invoice-preview"
          className="invoice-sheet"
          style={{
            fontFamily: "'Fututa Cyrillic', 'Futura Cyrillic', 'Futura-Cyrillic', 'Futura PT', 'Futura', 'Jost', sans-serif",
            fontSize: '9px',
            color: '#000',
            fontWeight: '400',
            letterSpacing: '-0.015em',
            width: '210mm',
            minHeight: '297mm',
            margin: '0 auto',
            padding: '4mm 6mm',
            boxSizing: 'border-box',
            backgroundColor: '#fff',
          }}
        >
          {/* ── Company header: logo left, name+details middle, address right ── */}
          <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 0, alignItems: 'stretch', minHeight: '60px' }}>
            <div style={{ flex: 1, width: '72px', minWidth: '72px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'left' }}>
              {settings?.companyLogo
                ? <img src={settings.companyLogo} alt="Logo" style={{ marginLeft: '10px', maxWidth: '250px', maxHeight: '180px', objectFit: 'contain', margin: '15px' }} />
                : <div style={{ width: '60px', height: '60px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#aaa', textAlign: 'center' }}>LOGO</div>
              }
            </div>
            <div style={{ width: '38%', padding: '10px 10px 4px', textAlign: 'left', fontSize: '13px', lineHeight: '1.4' }}>
              {settings?.address1 && <div>{settings.address1}</div>}
              {settings?.address2 && <div>{settings.address2}</div>}
              {(settings?.city || settings?.pincode) && (
                <div>{[settings?.city, settings?.pincode].filter(Boolean).join(' - ')}</div>
              )}
              {settings?.stateName && <div style={{ fontSize: '13px' }}>State Name : {settings.stateName}</div>}
              {settings?.email && <div>E-Mail : {settings.email}</div>}
              {settings?.gstin && <div style={{ fontSize: '14px' }}>GSTIN/UIN : {settings.gstin}</div>}
            </div>
          </div>

          {/* ── Buyer + Invoice meta: two-column row ── */}
          <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 0, minHeight: '107px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '55%', padding: '4px 8px', borderRight: '1px solid #000', lineHeight: '1.4' }}>
              <div style={{ flex: '1', fontWeight: 'bold', fontSize: '13px', marginBottom: '3px' }}>Buyer (Bill to)</div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>{formValues.buyerName}</div>
              <div style={{ fontSize: '13px' }}>{formValues.buyerAddressLine1}</div>
              {formValues.buyerAddressLine2 && <div style={{ fontSize: '13px' }}>{formValues.buyerAddressLine2}</div>}
              {formValues.buyerState && <div style={{ fontSize: '13px' }}>State Name : {formValues.buyerState}</div>}
              {formValues.buyerGstin && <div style={{ marginTop: '3px', fontSize: '14px' }}>GSTIN/UIN : {formValues.buyerGstin}</div>}
            </div>
            <div style={{ width: '45%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: '1', padding: '4px 6px', fontWeight: 'bold', fontSize: '20px', textAlign: 'center', marginBottom: '3px', marginTop: '9px', verticalAlign: 'middle' }}>TAX INVOICE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '46% 54%', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <div style={{ padding: '8px 6px', fontWeight: 'bold', fontSize: '13px', borderRight: '1px solid #000' }}>INVOICE NO.</div>
                <div style={{ padding: '8px 6px', fontWeight: 'bold', fontSize: '13px' }}>DATED</div>

              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '46% 54%' }}>
                <div style={{ padding: '8px 6px', fontSize: '13px', borderRight: '1px solid #000', fontWeight: '400' }}>{formValues.invoiceNumber}</div>
                <div style={{ padding: '8px 6px', fontSize: '13px', fontWeight: '400' }}>{formValues.invoiceDate}</div>

              </div>
            </div>
          </div>

          {(() => {
            const cols = ['6%', '37%', '10%', '12%', '11%', '9%', '16%']
            const colGroup = (
              <colgroup>
                {cols.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
            )
            const cellBorder = (i) => i < cols.length - 1 ? '1px solid #000' : 'none'
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', tableLayout: 'fixed' }}>
                {colGroup}
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    {['Sl No.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'Per', 'Amount'].map((h, i) => (
                      <th key={i} style={{ padding: '4px 5px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', borderRight: cellBorder(i), borderBottom: '1px solid #000', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Fixed-height body with always-visible column separators */}
                  <tr>
                    <td colSpan={7} style={{ padding: 0, height: '400px', verticalAlign: 'top', border: 0, position: 'relative', lineHeight: '1' }}>
                      {/* Column separator layer — always visible regardless of item count */}
                      <table style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        {colGroup}
                        <tbody>
                          <tr style={{ height: '400px' }}>
                            {cols.map((_, i) => (
                              <td key={i} style={{ borderRight: cellBorder(i), padding: 0 }}></td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                      {/* Item rows */}
                      <div style={{ position: 'relative', overflow: 'hidden', height: '400px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          {colGroup}
                          <tbody>
                            {(items || []).map((item, index) => {
                              const amount = Number(item.quantity || 0) * Number(item.rate || 0)
                              const cells = [
                                { val: index + 1, align: 'center' },
                                { val: item.description, align: 'left' },
                                { val: item.hsn || settings?.hsnSac || '', align: 'center' },
                                { val: item.quantity ? `${Number(item.quantity).toLocaleString('en-IN')} Pcs` : '', align: 'center' },
                                { val: item.rate ? Number(item.rate).toFixed(2) : '', align: 'center' },
                                { val: item.unit, align: 'center' },
                                { val: amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', align: 'center' },
                              ]
                              return (
                                <tr key={index}>
                                  {cells.map((cell, ci) => (
                                        <td key={ci} style={{ padding: '3px 5px', fontSize: '13px', fontWeight: '400', textAlign: cell.align, verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{cell.val}</td>                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>

                  {/* Taxable subtotal */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px' }}></td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      {Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px' }}>CGST 2.5%</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      {Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px' }}>SGST 2.5%</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      {Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {totals.roundOff !== 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px' }}>ROUND OFF</td>
                      <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '400', fontSize: '13px', borderLeft: '1px solid #000' }}>
                        {totals.roundOff < 0 ? '(-)' : '(+)'}{Math.abs(totals.roundOff).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={3} style={{ borderRight: '1px solid #000', textAlign: 'right', padding: '3px 5px', fontWeight: 'bold', fontSize: '13px' }}>Total</td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
                      {totals.totalQuantity ? `${Number(totals.totalQuantity).toLocaleString('en-IN')} Pcs` : ''}
                    </td>
                    <td colSpan={2} style={{ padding: '3px 5px' }}></td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: '700', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      Rs. {Number(totals.finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Amount in words */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: '4px 8px', lineHeight: '1' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Amount Chargeable (in words)</span>
                      <span style={{ float: 'right', fontSize: '13px' }}>E. &amp; O.E</span>
                      <div style={{ marginTop: '3px', fontWeight: '400', fontSize: '13px' }}>{toIndianCurrency(totals.finalAmount)}</div>
                    </td>
                  </tr>

                  {/* HSN/SAC GST summary */}
                  <tr style={{ borderTop: '1px solid #000', lineHeight: '1' }}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '14%' }} /><col style={{ width: '18%' }} />
                          <col style={{ width: '9%' }} /><col style={{ width: '14%' }} />
                          <col style={{ width: '9%' }} /><col style={{ width: '14%' }} />
                          <col style={{ width: '22%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '12px', textAlign: 'left', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} rowSpan={2}>HSN/SAC</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '12px', textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} rowSpan={2}>Taxable Value</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} colSpan={2}>Central Tax</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} colSpan={2}>State Tax</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '12px', textAlign: 'right', borderBottom: '1px solid #000' }} rowSpan={2}>Total Tax Amount</th>
                          </tr>
                          <tr>
                            {['Rate', 'Amount', 'Rate', 'Amount'].map((h, i) => (
                              <th key={i} style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '12px', textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const hsnMap = {}
                              ; (items || []).forEach((item) => {
                                const hsn = item.hsn || 'N/A'
                                hsnMap[hsn] = (hsnMap[hsn] || 0) + Number(item.quantity || 0) * Number(item.rate || 0)
                              })
                            return Object.entries(hsnMap).map(([hsn, taxable]) => {
                              const cgst = Number((taxable * 0.025).toFixed(2))
                              const sgst = Number((taxable * 0.025).toFixed(2))
                              return (
                                <tr key={hsn} style={{ borderBottom: '1px solid #000' }}>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'left', borderRight: '1px solid #000' }}>{hsn}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right' }}>{Number(cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              )
                            })
                          })()}
                          <tr style={{ borderTop: '1px solid #000' }}>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'left', borderRight: '1px solid #000' }}>Total</td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '400', textAlign: 'right' }}>{Number(totals.cgstAmount + totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Tax amount in words */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: '3px 8px', fontSize: '13px', fontWeight: '400' }}>
                      <strong>Tax Amount (in words) :</strong> {toIndianCurrency(totals.cgstAmount + totals.sgstAmount)}
                    </td>
                  </tr>

                  {/* Bank + Signatory */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div style={{ display: 'flex' }}>
                        <div style={{ width: '55%', padding: '4px 8px', borderRight: '1px solid #000' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', marginTop: '6px' }}>Company's Bank Details</div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px', fontWeight: 'bold' }}>Bank Name</span>
                              <span style={{ fontWeight: '400' }}>: {settings?.bankName || ''}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px', fontWeight: 'bold' }}>A/c No.</span>
                              <span style={{ fontWeight: '400' }}>: {settings?.accountNumber || ''}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px', fontWeight: 'bold' }}>IFS Code</span>
                              <span style={{ fontWeight: '400' }}>: {settings?.branchIfsc || ''}</span>
                            </div>
                          </div>

                        </div>
                        <div style={{ width: '45%', padding: '4px 8px', textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '15px' }}>for {settings?.companyName || ''}</div>
                          <div style={{ marginTop: '40px', fontWeight: 'bold', fontSize: '13px' }}>Authorised Signatory</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )
          })()}

          <div style={{ padding: '2px 5px', textAlign: 'center' }}>
            <div style={{ textTransform: 'uppercase', fontSize: '13px', fontWeight: 'bold' }}>SUBJECT TO TIRUPPUR JURISDICTION</div>
            <div style={{ marginTop: '2px', fontSize: '12px', fontWeight: '400' }}>This is a Computer Generated Invoice</div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default InvoicePreview