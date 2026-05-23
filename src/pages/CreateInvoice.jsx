import { useContext, useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'
import { api } from '../services/api'
import { downloadInvoicePdf, printInvoice } from '../pdf/invoicePdf'
import { formatCurrency, toIndianCurrency } from '../utils/format'

function CreateInvoice() {
  const { customers, products, settings, loadCustomers, loadProducts } = useContext(AppContext)
  const [invoiceMeta, setInvoiceMeta] = useState(null)
  const navigate = useNavigate()

  const { register, control, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
      deliveryNote: '',
      paymentTerms: '',
      referenceNo: '',
      referenceDate: new Date().toISOString().slice(0, 10),
      orderNo: '',
      orderDate: new Date().toISOString().slice(0, 10),
      dispatchDocNo: '',
      dispatchDate: new Date().toISOString().slice(0, 10),
      transporter: '',
      destination: '',
      termsOfDelivery: '',
      buyerName: '',
      buyerAddress: '',
      buyerGstin: '',
      buyerState: '',
      buyerStateCode: '',
      bankName: settings?.bankName || '',
      accountNumber: settings?.accountNumber || '',
      branchIfsc: settings?.branchIfsc || '',
      items: [
        {
          description: '',
          hsn: '',
          quantity: 1,
          rate: 0,
          unit: 'Pcs',
          taxRate: 5,
        },
      ],
      sequence: 0,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const formValues = watch()
  const buyerName = watch('buyerName')
  const buyerAddress = watch('buyerAddress')
  const buyerGstin = watch('buyerGstin')
  const buyerState = watch('buyerState')
  const buyerStateCode = watch('buyerStateCode')

  useEffect(() => {
    loadCustomers()
    loadProducts()
    fetchInvoiceNumber()
  }, [])

  useEffect(() => {
    if (settings) {
      setValue('bankName', settings.bankName || '')
      setValue('accountNumber', settings.accountNumber || '')
      setValue('branchIfsc', settings.branchIfsc || '')
    }
  }, [settings, setValue])

  const fetchInvoiceNumber = async () => {
    const response = await api.getNextInvoiceNumber()
    if (response.success === false) {
      toast.error('Unable to generate invoice number')
      return
    }
    setInvoiceMeta(response)
    setValue('invoiceNumber', response.invoiceNumber)
    setValue('sequence', response.nextSequence)
  }

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

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find((entry) => entry.id === Number(customerId))
    if (!customer) return
    setValue('buyerName', customer.name)
    setValue('buyerAddress', customer.billingAddress)
    setValue('buyerGstin', customer.gstin)
    setValue('buyerState', customer.state)
    setValue('buyerStateCode', customer.stateCode)
  }

  const handleProductSelect = (index, productId) => {
    const product = products.find((item) => item.id === Number(productId))
    if (!product) return
    setValue(`items.${index}.description`, product.name)
    setValue(`items.${index}.hsn`, product.hsn || '')
    setValue(`items.${index}.rate`, Number(product.rate || 0))
    setValue(`items.${index}.unit`, product.unit || 'Pcs')
    setValue(`items.${index}.taxRate`, Number(product.gstRate || 5))
  }

  const buildDraftInvoice = () => ({
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
    },
    invoice: {
      invoiceNumber: formValues.invoiceNumber || '',
      invoiceDate: formValues.invoiceDate || '',
      deliveryNote: formValues.deliveryNote || '',
      paymentTerms: formValues.paymentTerms || '',
      referenceNo: formValues.referenceNo || '',
      referenceDate: formValues.referenceDate || '',
      orderNo: formValues.orderNo || '',
      orderDate: formValues.orderDate || '',
      dispatchDocNo: formValues.dispatchDocNo || '',
      dispatchDate: formValues.dispatchDate || '',
      transporter: formValues.transporter || '',
      destination: formValues.destination || '',
      termsOfDelivery: formValues.termsOfDelivery || '',
      buyerName: formValues.buyerName || '',
      buyerAddress: formValues.buyerAddress || '',
      buyerGstin: formValues.buyerGstin || '',
      buyerState: formValues.buyerState || '',
      buyerStateCode: formValues.buyerStateCode || '',
      amountWords: toIndianCurrency(totals.finalAmount),
    },
    items: (formValues.items || []).map((item, index) => ({
      serial: index + 1,
      description: item.description || '',
      hsn: item.hsn || '',
      quantity: Number(item.quantity || 0),
      rate: Number(item.rate || 0),
      unit: item.unit || 'Pcs',
      amount: Number((Number(item.quantity || 0) * Number(item.rate || 0)).toFixed(2)),
    })),
    totals: {
      taxableValue: formatCurrency(totals.taxableValue),
      cgstAmount: formatCurrency(totals.cgstAmount),
      sgstAmount: formatCurrency(totals.sgstAmount),
      totalAmount: formatCurrency(totals.finalAmount),
      totalQuantity: totals.totalQuantity,
      amountWords: toIndianCurrency(totals.finalAmount),
    },
  })

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      bankName: settings?.bankName || data.bankName,
      accountNumber: settings?.accountNumber || data.accountNumber,
      branchIfsc: settings?.branchIfsc || data.branchIfsc,
      amountWords: toIndianCurrency(totals.finalAmount),
      taxAmountWords: toIndianCurrency(totals.cgstAmount + totals.sgstAmount),
      taxableValue: totals.taxableValue,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.finalAmount,
      totalQuantity: totals.totalQuantity,
      items: data.items.map((item, index) => ({
        serial: index + 1,
        description: item.description,
        hsn: item.hsn,
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
        unit: item.unit || 'Pcs',
        amount: Number((Number(item.quantity || 0) * Number(item.rate || 0)).toFixed(2)),
        taxRate: Number(item.taxRate || 5),
      })),
    }
    const response = await api.saveInvoice(payload)
    if (response.success === false) {
      toast.error('Unable to save invoice')
      return
    }
    toast.success('Invoice saved successfully')
    navigate(`/preview/${response.id}`)
  }

  return (
    <div className="space-y-6">
      {/* <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Create GST Invoice</h2>
            <p className="mt-1 text-sm text-slate-500">Build the invoice layout and print it exactly in classic style.</p>
          </div>
          <button
            type="button"
            onClick={() => downloadInvoicePdf(buildDraftInvoice(), `${invoiceMeta?.invoiceNumber || 'invoice'}.pdf`)}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none"
          >
            Download PDF Preview
          </button>
        </div>
      </div> */}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Buyer (Bill to)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Select Customer</label>
                <select
                  onChange={(event) => handleCustomerSelect(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="">Choose existing customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Buyer Name</label>
                <input {...register('buyerName')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Address</label>
                <textarea {...register('buyerAddress')} rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">GSTIN/UIN</label>
                  <input {...register('buyerGstin')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">State / Code</label>
                  <div className="mt-2 flex gap-3">
                    <input {...register('buyerState')} placeholder="Tamil Nadu" className="w-1/2 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                    <input {...register('buyerStateCode')} placeholder="33" className="w-1/2 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Invoice Details</h3>
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Invoice No.</label>
                  <input {...register('invoiceNumber')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Dated</label>
                  <input type="date" {...register('invoiceDate')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Delivery Note</label>
                  <input {...register('deliveryNote')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Mode/Terms of Payment</label>
                  <input {...register('paymentTerms')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Reference No.</label>
                  <input {...register('referenceNo')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Other References</label>
                  <input {...register('referenceDate')} type="date" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Buyer's Order No.</label>
                  <input {...register('orderNo')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Dated</label>
                  <input type="date" {...register('orderDate')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Dispatch Doc No.</label>
                  <input {...register('dispatchDocNo')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Delivery Note Date</label>
                  <input type="date" {...register('dispatchDate')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Dispatched Through</label>
                  <input {...register('transporter')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Destination</label>
                  <input {...register('destination')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Terms of Delivery</label>
                <input {...register('termsOfDelivery')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Invoice Items</h3>
              <p className="mt-1 text-sm text-slate-500">Use products to auto-fill HSN, unit, and rate.</p>
            </div>
            <button
              type="button"
              onClick={() => append({ description: '', hsn: '', quantity: 1, rate: 0, unit: 'Pcs', taxRate: 5 })}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full invoice-table border-separate border-spacing-0 bg-white text-left text-sm shadow-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">Sl No.</th>
                  <th className="px-4 py-3">Description of Goods</th>
                  <th className="px-4 py-3">HSN/SAC</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Per</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const quantity = Number(items?.[index]?.quantity || 0)
                  const rate = Number(items?.[index]?.rate || 0)
                  const amount = Number((quantity * rate).toFixed(2))
                  return (
                    <tr key={field.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <select
                            onChange={(event) => handleProductSelect(index, event.target.value)}
                            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            {...register(`items.${index}.description`)}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            placeholder="Description"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          {...register(`items.${index}.hsn`)}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                          placeholder="HSN/SAC"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          {...register(`items.${index}.rate`, { valueAsNumber: true })}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          {...register(`items.${index}.unit`)}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(amount)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-lg font-semibold text-slate-900">Company Bank Details</h3>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Bank Name</label>
                <input {...register('bankName')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">A/c No.</label>
                <input {...register('accountNumber')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Branch & IFS Code</label>
                <input {...register('branchIfsc')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-lg font-semibold text-slate-900">Totals</h3>
            <div className="mt-6 space-y-4 text-sm text-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span>Taxable Value</span>
                <strong>{formatCurrency(totals.taxableValue)}</strong>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span>CGST 2.5%</span>
                <strong>{formatCurrency(totals.cgstAmount)}</strong>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span>SGST 2.5%</span>
                <strong>{formatCurrency(totals.sgstAmount)}</strong>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span>Round Off</span>
                <strong>{formatCurrency(totals.roundOff)}</strong>
              </div>
              <div className="mt-4 rounded-3xl bg-slate-900 px-4 py-4 text-white shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <span>Total</span>
                  <span className="font-semibold">{formatCurrency(totals.finalAmount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                  <span>{totals.totalQuantity} Pcs</span>
                  <span>E. &amp; O.E</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Save Invoice
          </button>
          <button type="button" onClick={() => printInvoice(buildDraftInvoice())} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Print Invoice
          </button>
        </div>
      </form>

      {/* ── PRINT PREVIEW ─────────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div id="invoice-preview" className="invoice-sheet" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000' }}>

          {/* Title */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', letterSpacing: '2px' }}>
            TAX INVOICE
          </div>

          {/* Outer border wrapper */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
            <tbody>

              {/* ── ROW 1 : Left = Company Info + Buyer Info stacked | Right = Invoice Meta ── */}
              <tr>
                <td style={{ width: '55%', verticalAlign: 'top', padding: '0', borderRight: '1px solid #000' }}>
                  {/* Company info */}
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
                  {/* Buyer info directly below, same left column */}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Buyer (Bill to)</div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{watch('buyerName')}</div>
                    <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>{watch('buyerAddress')}</div>
                    {watch('buyerGstin') && <div style={{ marginTop: '4px' }}>GSTIN/UIN : {watch('buyerGstin')}</div>}
                    {watch('buyerState') && (
                      <div>
                        State Name : {watch('buyerState')}
                        {watch('buyerStateCode') ? `, Code : ${watch('buyerStateCode')}` : ''}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ width: '45%', verticalAlign: 'top', padding: '0' }}>
                  {/* Invoice meta as a nested 2-col table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
                    <tbody>
                      {[
                        ['Invoice No.', watch('invoiceNumber')],
                        ['Dated', watch('invoiceDate')],
                        ['Delivery Note', watch('deliveryNote')],
                        ['Mode/Terms of Payment', watch('paymentTerms')],
                        ['Reference No. & Date.', `${watch('referenceNo') || ''} ${watch('referenceDate') || ''}`.trim()],
                        ['Buyer\'s Order No.', watch('orderNo')],
                        ['Dated', watch('orderDate')],
                        ['Dispatch Doc No.', watch('dispatchDocNo')],
                        ['Delivery Note Date', watch('dispatchDate')],
                        ['Dispatched through', watch('transporter')],
                        ['Destination', watch('destination')],
                        ['Terms of Delivery', watch('termsOfDelivery')],
                      ].map(([label, value], i) => (
                        <tr key={i}>
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

              {/* ── ROW 3 : Items table ── */}
              <tr>
                <td colSpan={2} style={{ padding: '0', borderTop: '1px solid #000' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #000' }}>
                        {['Sl No.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Amount'].map((h, i) => (
                          <th key={i} style={{
                            padding: '5px 8px',
                            textAlign: i >= 3 ? 'right' : 'left',
                            fontWeight: '600',
                            borderRight: i < 6 ? '1px solid #000' : 'none',
                            whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
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
                      {/* Spacer row */}
                      <tr><td colSpan={7} style={{ height: '40px' }}></td></tr>

                      {/* CGST row */}
                      <tr style={{ borderTop: '1px solid #000' }}>
                        <td colSpan={6} style={{ padding: '3px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>CGST 2.5%</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                          {Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* SGST row */}
                      <tr>
                        <td colSpan={6} style={{ padding: '3px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>SGST 2.5%</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                          {Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* Round off row (only when non-zero) */}
                      {totals.roundOff !== 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '3px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>
                            Less : ROUND OFF
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            {totals.roundOff < 0 ? '(-)' : '(+)'}{Math.abs(totals.roundOff).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {/* Single Total row */}
                      <tr style={{ borderTop: '1px solid #000', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>Total</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>
                          {totals.totalQuantity ? `${Number(totals.totalQuantity).toLocaleString('en-IN')} Pcs` : ''}
                        </td>
                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid #000' }}></td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                          ₹ {Number(totals.finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* ── ROW 4 : Amount in words ── */}
              <tr style={{ borderTop: '1px solid #000' }}>
                <td colSpan={2} style={{ padding: '5px 10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ verticalAlign: 'top',  paddingRight: '10px', width: '70%' }}>
                          <span style={{ fontWeight: 'bold' }}>Amount Chargeable (in words)</span>
                          <span style={{ float: 'right', fontStyle: 'italic' }}>E. &amp; O.E</span>
                          <div style={{ marginTop: '4px', fontWeight: '600' }}>{toIndianCurrency(totals.finalAmount)}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* ── ROW 5 : HSN Tax summary table ── */}
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
                      {/* Group items by HSN */}
                      {(() => {
                        const hsnMap = {}
                        items.forEach(item => {
                          const hsn = item.hsn || 'N/A'
                          const amt = Number(item.quantity || 0) * Number(item.rate || 0)
                          hsnMap[hsn] = (hsnMap[hsn] || 0) + amt
                        })
                        return Object.entries(hsnMap).map(([hsn, taxable]) => {
                          const cgst = Number((taxable * 0.025).toFixed(2))
                          const sgst = Number((taxable * 0.025).toFixed(2))
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
                      {/* Totals row */}
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
                  {/* Tax amount in words */}
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #000', fontSize: '11px' }}>
                    <strong>Tax Amount (in words) :</strong> {toIndianCurrency(totals.cgstAmount + totals.sgstAmount)}
                  </div>
                </td>
              </tr>

              {/* ── ROW 6 : Declaration (left) + Bank Details + Signatory (right) ── */}
              <tr style={{ borderTop: '1px solid #000' }}>
                <td style={{ verticalAlign: 'top', padding: '8px 10px', borderRight: '1px solid #000', width: '55%' }}>
                  <div style={{marginBottom: '4px'  , fontWeight: 'bold', fontSize: '12px' }}>Company's Bank Details</div>
                  <div style={{ fontSize: '11px', lineHeight: '1.8', marginTop: '4px' }}>
                    <div>Bank Name : {watch('bankName') || settings?.bankName || ''}</div>
                    <div>A/c No. : {watch('accountNumber') || settings?.accountNumber || ''}</div>
                    <div>Branch &amp; IFS Code : {watch('branchIfsc') || settings?.branchIfsc || ''}</div>
                  </div>
                  <div style={{ marginTop: '12px',fontWeight: 'bold'}}>Declaration</div>
                  <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                  </div>
                </td>
                <td style={{ verticalAlign: 'top', padding: '8px 10px', textAlign: 'right' }}>
                  <div>for {settings?.companyName || 'EXTREME EMBROIDERIES'}</div>
                  <div style={{ marginTop: '100px', fontWeight: 'bold' }}>Authorised Signatory</div>
                </td>
              </tr>

              {/* ── ROW 7 : Footer ── */}
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

export default CreateInvoice