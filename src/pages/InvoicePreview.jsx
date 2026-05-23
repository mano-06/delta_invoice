import { useContext, useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'
import { api } from '../services/api'
import { downloadInvoicePdf, printInvoice } from '../pdf/invoicePdf'
import { toIndianCurrency } from '../utils/format'

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
      invoiceDate: new Date().toISOString().slice(0, 10),
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
      buyerAddress: '',
      buyerGstin: '',
      buyerState: '',
      buyerStateCode: '',
      bankName: settings?.bankName || '',
      accountNumber: settings?.accountNumber || '',
      branchIfsc: settings?.branchIfsc || '',
      items: [{ description: '', hsn: '', quantity: 1, rate: 0, unit: 'Pcs' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const formValues = watch()
  const items = watch('items')

  useEffect(() => {
    loadInvoice()
  }, [id])

  useEffect(() => {
    if (!invoice) {
      return
    }
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
    buyerAddress: record.buyerAddress || '',
    buyerGstin: record.buyerGstin || '',
    buyerState: record.buyerState || '',
    buyerStateCode: record.buyerStateCode || '',
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

  const buildPreviewInvoice = () => ({
    settings: {
      companyName: settings?.companyName || 'EXTREME EMBROIDERIES',
      address1: settings?.address1 || '',
      address2: settings?.address2 || '',
      city: settings?.city || '',
      pincode: settings?.pincode || '',
      gstin: settings?.gstin || '',
      stateName: settings?.stateName || '',
      stateCode: settings?.stateCode || '',
      email: settings?.email || '',
      bankName: settings?.bankName || '',
      accountNumber: settings?.accountNumber || '',
      branchIfsc: settings?.branchIfsc || '',
    },
    invoice: {
      invoiceNumber: formValues.invoiceNumber || invoice?.invoiceNumber || '',
      invoiceDate: formValues.invoiceDate || invoice?.invoiceDate || '',
      deliveryNote: formValues.deliveryNote || invoice?.deliveryNote || '',
      paymentTerms: formValues.paymentTerms || invoice?.paymentTerms || '',
      referenceNo: formValues.referenceNo || invoice?.referenceNo || '',
      referenceDate: formValues.referenceDate || invoice?.referenceDate || '',
      orderNo: formValues.orderNo || invoice?.orderNo || '',
      orderDate: formValues.orderDate || invoice?.orderDate || '',
      dispatchDocNo: formValues.dispatchDocNo || invoice?.dispatchDocNo || '',
      dispatchDate: formValues.dispatchDate || invoice?.dispatchDate || '',
      transporter: formValues.transporter || invoice?.transporter || '',
      destination: formValues.destination || invoice?.destination || '',
      termsOfDelivery: formValues.termsOfDelivery || invoice?.termsOfDelivery || '',
      buyerName: formValues.buyerName || invoice?.buyerName || '',
      buyerAddress: formValues.buyerAddress || invoice?.buyerAddress || '',
      buyerGstin: formValues.buyerGstin || invoice?.buyerGstin || '',
      buyerState: formValues.buyerState || invoice?.buyerState || '',
      buyerStateCode: formValues.buyerStateCode || invoice?.buyerStateCode || '',
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
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.finalAmount,
      amountWords: toIndianCurrency(totals.finalAmount),
    },
  })

  const onSave = async (data) => {
    if (!invoice) {
      return
    }

    setIsSaving(true)

    try {
      const payload = {
        ...data,
        id: invoice.id,
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
    if (!invoice) {
      return
    }

    reset(mapInvoiceToForm(invoice))
    setIsEditing(false)
  }

  if (!invoice) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-card">Loading invoice preview…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Invoice Preview</h2>
          <p className="mt-1 text-sm text-slate-500">Review, print or download the A4 invoice, and edit the saved invoice when needed.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              if (!isEditing) {
                setIsEditing(true)
                return
              }

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
          <button
            type="button"
            onClick={() => downloadInvoicePdf(buildPreviewInvoice(), `${formValues.invoiceNumber || invoice.invoiceNumber || 'invoice'}.pdf`)}
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
                <label className="text-sm font-medium text-slate-700">
                  Delivery Note
                  <input {...register('deliveryNote')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Mode / Terms of Payment
                  <input {...register('paymentTerms')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Reference No.
                  <input {...register('referenceNo')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Reference Date
                  <input type="date" {...register('referenceDate')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Buyer's Order No.
                  <input {...register('orderNo')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Order Date
                  <input type="date" {...register('orderDate')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Dispatch Doc No.
                  <input {...register('dispatchDocNo')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Dispatch Date
                  <input type="date" {...register('dispatchDate')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Transporter
                  <input {...register('transporter')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Destination
                  <input {...register('destination')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Terms of Delivery
                  <input {...register('termsOfDelivery')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Buyer Name
                  <input {...register('buyerName')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Buyer Address
                  <textarea {...register('buyerAddress')} rows={3} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Buyer GSTIN
                  <input {...register('buyerGstin')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Buyer State
                  <input {...register('buyerState')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Buyer State Code
                  <input {...register('buyerStateCode')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Bank Name
                  <input {...register('bankName')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Account Number
                  <input {...register('accountNumber')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Branch / IFSC
                  <input {...register('branchIfsc')} className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-slate-900">Line Items</h4>
                  <button
                    type="button"
                    onClick={() => append({ description: '', hsn: '', quantity: 1, rate: 0, unit: 'Pcs' })}
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div id="invoice-preview" className="invoice-sheet" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', letterSpacing: '2px' }}>
            TAX INVOICE
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
            <tbody>
              <tr>
                <td style={{ width: '55%', verticalAlign: 'top', padding: '0', borderRight: '1px solid #000' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #000' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {settings?.companyName || 'EXTREME EMBROIDERIES'}
                    </div>
                    <div style={{ lineHeight: '1.6' }}>
                      {settings?.address1 && <div>{settings.address1}</div>}
                      {settings?.address2 && <div>{settings.address2}</div>}
                      {(settings?.city || settings?.pincode) && (
                        <div>{[settings?.city, settings?.pincode].filter(Boolean).join(' - ')}</div>
                      )}
                      {settings?.gstin && <div style={{ marginTop: '4px' }}>GSTIN/UIN : {settings.gstin}</div>}
                      {settings?.stateName && (
                        <div>State Name : {settings.stateName}{settings?.stateCode ? `, Code : ${settings.stateCode}` : ''}</div>
                      )}
                      {settings?.email && <div>E-Mail : {settings.email}</div>}
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Buyer (Bill to)</div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{formValues.buyerName}</div>
                    <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>{formValues.buyerAddress}</div>
                    {formValues.buyerGstin && <div style={{ marginTop: '4px' }}>GSTIN/UIN : {formValues.buyerGstin}</div>}
                    {formValues.buyerState && (
                      <div>
                        State Name : {formValues.buyerState}
                        {formValues.buyerStateCode ? `, Code : ${formValues.buyerStateCode}` : ''}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ width: '45%', verticalAlign: 'top', padding: '0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
                    <tbody>
                      {[
                        ['Invoice No.', formValues.invoiceNumber],
                        ['Dated', formValues.invoiceDate],
                        ['Delivery Note', formValues.deliveryNote],
                        ['Mode/Terms of Payment', formValues.paymentTerms],
                        ['Reference No. & Date.', `${formValues.referenceNo || ''} ${formValues.referenceDate || ''}`.trim()],
                        ['Buyer\'s Order No.', formValues.orderNo],
                        ['Dated', formValues.orderDate],
                        ['Dispatch Doc No.', formValues.dispatchDocNo],
                        ['Delivery Note Date', formValues.dispatchDate],
                        ['Dispatched through', formValues.transporter],
                        ['Destination', formValues.destination],
                        ['Terms of Delivery', formValues.termsOfDelivery],
                      ].map(([label, value], index) => (
                        <tr key={index}>
                          <td style={{ padding: '3px 8px', borderBottom: '1px solid #000', borderRight: '1px solid #000', fontWeight: '600', width: '50%', verticalAlign: 'top' }}>
                            {label}
                          </td>
                          <td style={{ padding: '3px 8px', borderBottom: '1px solid #000', verticalAlign: 'top' }}>
                            {value || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr>
                <td colSpan={2} style={{ padding: '0', borderTop: '1px solid #000' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #000' }}>
                        {['Sl No.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Amount'].map((header, index) => (
                          <th key={index} style={{
                            padding: '5px 8px',
                            textAlign: index >= 3 ? 'right' : 'left',
                            fontWeight: '600',
                            borderRight: index < 6 ? '1px solid #000' : 'none',
                            whiteSpace: 'nowrap',
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(items || []).map((item, index) => {
                        const amount = Number(item.quantity || 0) * Number(item.rate || 0)
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '4px 8px', verticalAlign: 'top', borderRight: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ padding: '4px 8px', verticalAlign: 'top', borderRight: '1px solid #000' }}>{item.description}</td>
                            <td style={{ padding: '4px 8px', verticalAlign: 'top', borderRight: '1px solid #000', textAlign: 'right' }}>{item.hsn}</td>
                            <td style={{ padding: '4px 8px', verticalAlign: 'top', borderRight: '1px solid #000', textAlign: 'right' }}>
                              {item.quantity ? `${Number(item.quantity).toLocaleString('en-IN')} Pcs` : ''}
                            </td>
                            <td style={{ padding: '4px 8px', verticalAlign: 'top', borderRight: '1px solid #000', textAlign: 'right' }}>
                              {item.rate ? Number(item.rate).toFixed(2) : ''}
                            </td>
                            <td style={{ padding: '4px 8px', verticalAlign: 'top', borderRight: '1px solid #000', textAlign: 'right' }}>{item.unit}</td>
                            <td style={{ padding: '4px 8px', verticalAlign: 'top', textAlign: 'right' }}>
                              {amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                            </td>
                          </tr>
                        )
                      })}
                      <tr><td colSpan={7} style={{ height: '40px' }}></td></tr>

                      <tr style={{ borderTop: '1px solid #000' }}>
                        <td colSpan={6} style={{ padding: '3px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>CGST 2.5%</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                          {Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={6} style={{ padding: '3px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>SGST 2.5%</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                          {Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {totals.roundOff !== 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '3px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>Less : ROUND OFF</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>{totals.roundOff < 0 ? '(-)' : '(+)'}{Math.abs(totals.roundOff).toFixed(2)}</td>
                        </tr>
                      )}
                      <tr style={{ borderTop: '1px solid #000', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>Total</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>
                          {totals.totalQuantity ? `${Number(totals.totalQuantity).toLocaleString('en-IN')} Pcs` : ''}
                        </td>
                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid #000' }}></td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>₹ {Number(totals.finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr style={{ borderTop: '1px solid #000' }}>
                <td colSpan={2} style={{ padding: '5px 10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ verticalAlign: 'top', borderRight: '1px solid #000', paddingRight: '10px', width: '70%' }}>
                          <span style={{ fontWeight: 'bold' }}>Amount Chargeable (in words)</span>
                          <span style={{ float: 'right', fontStyle: 'italic' }}>E. &amp; O.E</span>
                          <div style={{ marginTop: '4px', fontWeight: '600' }}>{toIndianCurrency(totals.finalAmount)}</div>
                        </td>
                        <td style={{ verticalAlign: 'top', paddingLeft: '10px' }}></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr style={{ borderTop: '1px solid #000' }}>
                <td colSpan={2} style={{ padding: '0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #000', backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '4px 8px', borderRight: '1px solid #000', textAlign: 'left' }}>HSN/SAC</th>
                        <th style={{ padding: '4px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>Taxable Value</th>
                        <th style={{ padding: '4px 8px', borderRight: '1px solid #000', textAlign: 'center' }} colSpan={2}>Central Tax</th>
                        <th style={{ padding: '4px 8px', borderRight: '1px solid #000', textAlign: 'center' }} colSpan={2}>State Tax</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right' }}>Total Tax Amount</th>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #000' }}>
                        <th style={{ padding: '3px 8px', borderRight: '1px solid #000' }}></th>
                        <th style={{ padding: '3px 8px', borderRight: '1px solid #000' }}></th>
                        <th style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const hsnMap = {}

                        ;(items || []).forEach((item) => {
                          const hsn = item.hsn || 'N/A'
                          const taxable = Number(item.quantity || 0) * Number(item.rate || 0)
                          hsnMap[hsn] = (hsnMap[hsn] || 0) + taxable
                        })

                        return Object.entries(hsnMap).map(([hsn, taxable]) => {
                          const cgst = Number((Number(taxable) * 0.025).toFixed(2))
                          const sgst = Number((Number(taxable) * 0.025).toFixed(2))

                          return (
                            <tr key={hsn} style={{ borderBottom: '1px solid #ddd' }}>
                              <td style={{ padding: '3px 8px', borderRight: '1px solid #000' }}>{hsn}</td>
                              <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                                {Number(taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>2.50%</td>
                              <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                                {Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>2.50%</td>
                              <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                                {Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                                {Number(cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )
                        })
                      })()}
                      <tr style={{ borderTop: '1px solid #000', fontWeight: 'bold' }}>
                        <td style={{ padding: '3px 8px', borderRight: '1px solid #000' }}>Total</td>
                        <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                          {Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '3px 8px', borderRight: '1px solid #000' }}></td>
                        <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                          {Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '3px 8px', borderRight: '1px solid #000' }}></td>
                        <td style={{ padding: '3px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                          {Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                          {Number(totals.cgstAmount + totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #000', fontSize: '11px' }}>
                    <strong>Tax Amount (in words) :</strong> {toIndianCurrency(totals.cgstAmount + totals.sgstAmount)}
                  </div>
                </td>
              </tr>

              <tr style={{ borderTop: '1px solid #000' }}>
                <td style={{ verticalAlign: 'top', padding: '8px 10px', borderRight: '1px solid #000', width: '55%' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Declaration</div>
                  <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                  </div>
                  <div style={{ marginTop: '12px', fontWeight: 'bold', fontSize: '11px' }}>Company's Bank Details</div>
                  <div style={{ fontSize: '11px', lineHeight: '1.8', marginTop: '4px' }}>
                    <div>Bank Name : {formValues.bankName || settings?.bankName || ''}</div>
                    <div>A/c No. : {formValues.accountNumber || settings?.accountNumber || ''}</div>
                    <div>Branch &amp; IFS Code : {formValues.branchIfsc || settings?.branchIfsc || ''}</div>
                  </div>
                </td>
                <td style={{ verticalAlign: 'top', padding: '8px 10px', textAlign: 'right' }}>
                  <div>for {settings?.companyName || 'EXTREME EMBROIDERIES'}</div>
                  <div style={{ marginTop: '50px', fontWeight: 'bold' }}>Authorised Signatory</div>
                </td>
              </tr>

              <tr style={{ borderTop: '1px solid #000' }}>
                <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', letterSpacing: '1px' }}>
                  <div style={{ textTransform: 'uppercase' }}>SUBJECT TO TIRUPPUR JURISDICTION</div>
                  <div style={{ marginTop: '2px' }}>This is a Computer Generated Invoice</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default InvoicePreview
