import { useContext, useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'
import { api } from '../services/api'
import { downloadInvoicePdf, printInvoice } from '../pdf/invoicePdf'
import { formatCurrency, toIndianCurrency } from '../utils/format'

const splitBuyerAddress = (value = '') => {
  const lines = String(value || '').split(/\r?\n/).map((line) => line.trim())
  return {
    buyerAddressLine1: lines[0] || '',
    buyerAddressLine2: lines.slice(1).join(' ').trim(),
  }
}

const joinBuyerAddress = (line1 = '', line2 = '') => [line1.trim(), line2.trim()].filter(Boolean).join('\n')

function CreateInvoice() {
  const { customers, products, settings, loadCustomers, loadProducts } = useContext(AppContext)
  const [invoiceMeta, setInvoiceMeta] = useState(null)
  const navigate = useNavigate()
  const descriptionRefs = useRef([])

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
      buyerAddressLine1: '',
      buyerAddressLine2: '',
      buyerGstin: '',
      buyerState: '',
      bankName: settings?.bankName || '',
      accountNumber: settings?.accountNumber || '',
      branchIfsc: settings?.branchIfsc || '',
      items: [
        {
          description: '',
          hsn: settings?.hsnSac || '',
          quantity: 1,
          rate: 0,
          unit: 'Pcs',
          taxRate: 5,
          productId: '',
        },
      ],
      sequence: 0,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const formValues = watch()
  const buyerName = watch('buyerName')
  const buyerGstin = watch('buyerGstin')
  const buyerState = watch('buyerState')

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

  useEffect(() => {
    if (!settings) return

    items?.forEach((item, index) => {
      if (!item?.hsn) {
        setValue(`items.${index}.hsn`, settings.hsnSac || '')
      }
    })
  }, [items, settings, setValue])

  const appendRow = () => {
    const nextIndex = fields.length
    append({ description: '', hsn: settings?.hsnSac || '', quantity: 1, rate: 0, unit: 'Pcs', taxRate: 5, productId: '' })
    window.setTimeout(() => {
      descriptionRefs.current[nextIndex]?.focus()
    }, 0)
  }

  const handleRowKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      appendRow()
    }
  }

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
    const { buyerAddressLine1, buyerAddressLine2 } = splitBuyerAddress(customer.billingAddress)
    setValue('buyerAddressLine1', buyerAddressLine1)
    setValue('buyerAddressLine2', buyerAddressLine2)
    setValue('buyerGstin', customer.gstin)
    setValue('buyerState', customer.state)
  }

  const handleProductSelect = (index, productId) => {
    setValue(`items.${index}.productId`, productId || '')

    if (!productId) {
      return
    }

    const product = products.find((item) => item.id === Number(productId))
    if (!product) return
    setValue(`items.${index}.description`, product.name || '')
    setValue(`items.${index}.hsn`, product.hsn || settings?.hsnSac || '')
    setValue(`items.${index}.rate`, Number(product.rate || 0))
    setValue(`items.${index}.unit`, product.unit || 'Pcs')
    setValue(`items.${index}.taxRate`, Number(product.gstRate || 5))
  }

  const buildDraftInvoice = () => ({
    settings: {
      companyName: settings?.companyName || '',
      address1: settings?.address1 || '',
      address2: settings?.address2 || '',
      city: settings?.city || '',
      pincode: settings?.pincode || '',
      gstin: settings?.gstin || '',
      stateName: settings?.stateName || '',
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
      buyerAddress: joinBuyerAddress(formValues.buyerAddressLine1, formValues.buyerAddressLine2),
      buyerGstin: formValues.buyerGstin || '',
      buyerState: formValues.buyerState || '',
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
      buyerAddress: joinBuyerAddress(data.buyerAddressLine1, data.buyerAddressLine2),
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
        productId: item.productId,
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

  // ── PRINT PREVIEW STYLES ────────────────────────────────────────────────────
  // Base font size for the invoice sheet — tuned so ~30 items fit on one page.
  const INV_FONT = '9px'
  // Fixed height of the items body area (covers ~30 rows at 9 px line height)
  const ITEMS_BODY_HEIGHT = '420px'

  // Cell style helpers
  const thStyle = (align = 'left', extra = {}) => ({
    padding: '3px 5px',
    fontWeight: 'bold',
    textAlign: align,
    borderRight: '1px solid #000',
    borderBottom: '1px solid #000',
    whiteSpace: 'nowrap',
    fontSize: INV_FONT,
    ...extra,
  })
  const tdStyle = (align = 'left', extra = {}) => ({
    padding: '2px 5px',
    textAlign: align,
    borderRight: '1px solid #000',
    verticalAlign: 'top',
    fontSize: INV_FONT,
    fontWeight: 'bold',
    ...extra,
  })

  return (
    <div className="space-y-6">
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
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Address Line 1</label>
                  <input {...register('buyerAddressLine1')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Address Line 2</label>
                  <input {...register('buyerAddressLine2')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">GSTIN/UIN</label>
                  <input {...register('buyerGstin')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">State</label>
                  <input {...register('buyerState')} placeholder="Tamil Nadu" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Invoice Details</h3>
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
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Invoice Items</h3>
            <p className="mt-1 text-sm text-slate-500">Press Enter in the description field to add a new row. Use products to auto-fill unit and rate.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full invoice-table border-separate border-spacing-0 bg-white text-left text-sm shadow-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ minWidth: '60px', width: '8%' }} />
                <col style={{ minWidth: '220px', width: '28%' }} />
                <col style={{ minWidth: '120px', width: '14%' }} />
                <col style={{ minWidth: '120px', width: '14%' }} />
                <col style={{ minWidth: '100px', width: '12%' }} />
                <col style={{ minWidth: '120px', width: '14%' }} />
                <col style={{ minWidth: '120px', width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-4 py-3">Sl No.</th>
                  <th className="px-4 py-3">Description of Goods</th>
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
                  const currentItem = items?.[index] || {}
                  return (
                    <tr key={field.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <select
                            value={currentItem.productId || ''}
                            onChange={(event) => handleProductSelect(index, event.target.value)}
                            onKeyDown={handleRowKeyDown}
                            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={currentItem.description || ''}
                            onChange={(event) => setValue(`items.${index}.description`, event.target.value)}
                            ref={(element) => {
                              descriptionRefs.current[index] = element
                            }}
                            onKeyDown={handleRowKeyDown}
                            className="min-w-[220px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            placeholder="Description"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          onKeyDown={handleRowKeyDown}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          {...register(`items.${index}.rate`, { valueAsNumber: true })}
                          onKeyDown={handleRowKeyDown}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          {...register(`items.${index}.unit`)}
                          onKeyDown={handleRowKeyDown}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(amount)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (index === 0) return
                            remove(index)
                          }}
                          disabled={index === 0}
                          className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
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

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
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
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card overflow-x-auto">
        <div
          id="invoice-preview"
          className="invoice-sheet"
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: INV_FONT,
            color: '#000',
            fontWeight: 'bold',
            width: '210mm',
            minHeight: '297mm',
            margin: '0 auto',
            padding: '6mm',
            boxSizing: 'border-box',
            backgroundColor: '#fff',
          }}
        >
          {/* Title */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', letterSpacing: '2px' }}>
            TAX INVOICE
          </div>

          {/* Outer border wrapper */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
            <tbody>

              {/* ── ROW 1 : Company Info (left) | Invoice Meta + Buyer Info (right) ── */}
              <tr>
                {/* LEFT: Company info only */}
                <td style={{ width: '50%', verticalAlign: 'top', padding: '0', borderRight: '1px solid #000' }}>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', marginBottom: '3px' }}>
                      {settings?.companyName || ''}
                    </div>
                    <div style={{ lineHeight: '1.5', fontWeight: 'bold' }}>
                      {settings?.address1 && <div>{settings.address1}</div>}
                      {settings?.address2 && <div>{settings.address2}</div>}
                      {(settings?.city || settings?.pincode) && (
                        <div>{[settings?.city, settings?.pincode].filter(Boolean).join(' - ')}</div>
                      )}
                      {settings?.gstin && <div style={{ marginTop: '3px' }}>GSTIN/UIN : {settings.gstin}</div>}
                      {settings?.stateName && <div>State Name : {settings.stateName}</div>}
                      {settings?.email && <div>E-Mail : {settings.email}</div>}
                    </div>
                  </div>
                </td>

                {/* RIGHT: Invoice meta rows, then Buyer info below */}
                <td style={{ width: '50%', verticalAlign: 'top', padding: '0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {/* Invoice No. */}
                      <tr>
                        <td style={{ padding: '3px 6px', borderBottom: '1px solid #000', borderRight: '1px solid #000', fontWeight: 'bold', width: '45%', fontSize: INV_FONT }}>
                          Invoice No.
                        </td>
                        <td style={{ padding: '3px 6px', borderBottom: '1px solid #000', fontWeight: 'bold', fontSize: INV_FONT }}>
                          {watch('invoiceNumber')}
                        </td>
                      </tr>
                      {/* Dated */}
                      <tr>
                        <td style={{ padding: '3px 6px', borderBottom: '1px solid #000', borderRight: '1px solid #000', fontWeight: 'bold', fontSize: INV_FONT }}>
                          Dated
                        </td>
                        <td style={{ padding: '3px 6px', borderBottom: '1px solid #000', fontWeight: 'bold', fontSize: INV_FONT }}>
                          {watch('invoiceDate')}
                        </td>
                      </tr>
                      {/* Buyer info — full width cell spanning both columns */}
                      <tr>
                        <td colSpan={2} style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: INV_FONT }}>Buyer (Bill to)</div>
                          <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{watch('buyerName')}</div>
                          <div style={{ lineHeight: '1.5', fontWeight: 'bold', fontSize: INV_FONT }}>{watch('buyerAddressLine1')}</div>
                          {watch('buyerAddressLine2') && (
                            <div style={{ lineHeight: '1.5', fontWeight: 'bold', fontSize: INV_FONT }}>{watch('buyerAddressLine2')}</div>
                          )}
                          {watch('buyerGstin') && (
                            <div style={{ marginTop: '3px', fontWeight: 'bold', fontSize: INV_FONT }}>GSTIN/UIN : {watch('buyerGstin')}</div>
                          )}
                          {watch('buyerState') && (
                            <div style={{ fontWeight: 'bold', fontSize: INV_FONT }}>State Name : {watch('buyerState')}</div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* ── ROW 2 : Items table with FIXED HEIGHT ── */}
              <tr>
                <td colSpan={2} style={{ padding: '0', borderTop: '1px solid #000' }}>

                  {/* Column widths defined once as percentage strings for reuse */}
                  {(() => {
                    const cols = ['5%', '38%', '10%', '12%', '11%', '8%', '16%']
                    const colGroup = (
                      <colgroup>
                        {cols.map((w, i) => <col key={i} style={{ width: w }} />)}
                      </colgroup>
                    )

                    // Shared border-right for all except last column
                    const cellBorder = (i) => i < cols.length - 1 ? '1px solid #000' : 'none'

                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        {colGroup}

                        {/* Header row */}
                        <thead>
                          <tr style={{ borderBottom: '1px solid #000' }}>
                            {['Sl No.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Amount'].map((h, i) => (
                              <th key={i} style={{
                                padding: '3px 5px',
                                fontWeight: 'bold',
                                fontSize: INV_FONT,
                                textAlign: i === 0 ? 'center' : i === 1 ? 'left' : 'right',
                                borderRight: cellBorder(i),
                                borderBottom: '1px solid #000',
                                whiteSpace: 'nowrap',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {/* Fixed-height container row: a single <tr><td> holding a div that clips content */}
                          <tr>
                            <td colSpan={7} style={{ padding: 0, height: ITEMS_BODY_HEIGHT, verticalAlign: 'top' }}>
                              {/*
                                The div clips at ITEMS_BODY_HEIGHT so the invoice is always
                                the same size regardless of item count. The inner table
                                inherits column widths from the outer table via percentage
                                widths set explicitly on each cell.
                              */}
                              <div style={{ height: ITEMS_BODY_HEIGHT, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                  {colGroup}
                                  <tbody>
                                    {items.map((item, index) => {
                                      const amount = Number(item.quantity || 0) * Number(item.rate || 0)
                                      const hsnValue = item.hsn || settings?.hsnSac || ''
                                      const cells = [
                                        { val: index + 1, align: 'center' },
                                        { val: item.description, align: 'left' },
                                        { val: hsnValue, align: 'right' },
                                        { val: item.quantity ? `${Number(item.quantity).toLocaleString('en-IN')} Pcs` : '', align: 'right' },
                                        { val: item.rate ? Number(item.rate).toFixed(2) : '', align: 'right' },
                                        { val: item.unit, align: 'right' },
                                        { val: amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', align: 'right' },
                                      ]
                                      return (
                                        <tr key={index}>
                                          {cells.map((cell, ci) => (
                                            <td key={ci} style={{
                                              padding: '2px 5px',
                                              fontSize: INV_FONT,
                                              fontWeight: 'bold',
                                              textAlign: cell.align,
                                              borderRight: cellBorder(ci),
                                              verticalAlign: 'top',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                            }}>{cell.val}</td>
                                          ))}
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
                            <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT }}></td>
                            <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT, borderLeft: '1px solid #000' }}>
                              {Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {/* CGST */}
                          <tr>
                            <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT }}>CGST 2.5%</td>
                            <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT, borderLeft: '1px solid #000' }}>
                              {Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {/* SGST */}
                          <tr>
                            <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT }}>SGST 2.5%</td>
                            <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT, borderLeft: '1px solid #000' }}>
                              {Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {/* Round off */}
                          {totals.roundOff !== 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT }}>
                                ROUND OFF
                              </td>
                              <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT, borderLeft: '1px solid #000' }}>
                                {totals.roundOff < 0 ? '(-)' : '(+)'}{Math.abs(totals.roundOff).toFixed(2)}
                              </td>
                            </tr>
                          )}
                          {/* Grand total */}
                          <tr style={{ borderTop: '1px solid #000' }}>
                            <td style={{ padding: '3px 5px', fontWeight: 'bold', fontSize: INV_FONT }}>Total</td>
                            <td colSpan={2} style={{ padding: '3px 5px', fontWeight: 'bold', fontSize: INV_FONT }}></td>
                            <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT }}>
                              {totals.totalQuantity ? `${Number(totals.totalQuantity).toLocaleString('en-IN')} Pcs` : ''}
                            </td>
                            <td colSpan={2} style={{ padding: '3px 5px' }}></td>
                            <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: INV_FONT, borderLeft: '1px solid #000' }}>
                              ₹ {Number(totals.finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* ── Amount in words — spans full width inside the items table ── */}
                          <tr style={{ borderTop: '1px solid #000' }}>
                            <td colSpan={7} style={{ padding: '4px 8px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: INV_FONT }}>Amount Chargeable (in words)</span>
                              <span style={{ float: 'right', fontStyle: 'italic', fontSize: INV_FONT }}>E. &amp; O.E</span>
                              <div style={{ marginTop: '3px', fontWeight: 'bold', fontSize: INV_FONT }}>{toIndianCurrency(totals.finalAmount)}</div>
                            </td>
                          </tr>

                          {/* ── GST Summary header row 1 ── */}
                          <tr style={{ borderTop: '1px solid #000', backgroundColor: '#fff' }}>
                            <td colSpan={7} style={{ padding: 0 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', backgroundColor: '#fff' }}>
                                <colgroup>
                                  <col style={{ width: '14%' }} />
                                  <col style={{ width: '18%' }} />
                                  <col style={{ width: '9%' }} />
                                  <col style={{ width: '14%' }} />
                                  <col style={{ width: '9%' }} />
                                  <col style={{ width: '14%' }} />
                                  <col style={{ width: '22%' }} />
                                </colgroup>
                                <thead>
                                  {/* Row 1: merged headers */}
                                  <tr style={{ borderBottom: '1px solid #000' }}>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'left',   borderRight: '1px solid #000', borderBottom: '1px solid #000' }} rowSpan={2}>HSN/SAC</th>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'right',  borderRight: '1px solid #000', borderBottom: '1px solid #000' }} rowSpan={2}>Taxable Value</th>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} colSpan={2}>Central Tax</th>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} colSpan={2}>State Tax</th>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'right',  borderBottom: '1px solid #000' }} rowSpan={2}>Total Tax Amount</th>
                                  </tr>
                                  {/* Row 2: Rate / Amount sub-headers */}
                                  <tr style={{ borderBottom: '1px solid #000' }}>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>Rate</th>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>Amount</th>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>Rate</th>
                                    <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: INV_FONT, textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* HSN data rows */}
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
                                        <tr key={hsn} style={{ borderBottom: '1px solid #000' }}>
                                          <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'left',  borderRight: '1px solid #000' }}>{hsn}</td>
                                          <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                          <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                          <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right' }}>{Number(cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      )
                                    })
                                  })()}
                                  {/* GST totals row */}
                                  <tr style={{ borderTop: '1px solid #000' }}>
                                    <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'left',  borderRight: '1px solid #000' }}>Total</td>
                                    <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                                    <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                                    <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '2px 5px', fontSize: INV_FONT, fontWeight: 'bold', textAlign: 'right' }}>{Number(totals.cgstAmount + totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>

                          {/* ── Tax amount in words ── */}
                          <tr style={{ borderTop: '1px solid #000' }}>
                            <td colSpan={7} style={{ padding: '3px 8px', fontSize: INV_FONT, fontWeight: 'bold' }}>
                              <strong>Tax Amount (in words) :</strong> {toIndianCurrency(totals.cgstAmount + totals.sgstAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )
                  })()}

                </td>
              </tr>

              {/* ── ROW 5 : Bank Details (left) + Signatory (right) ── */}
              <tr style={{ borderTop: '1px solid #000' }}>
                <td style={{ verticalAlign: 'top', padding: '6px 8px', borderRight: '1px solid #000' }}>
                  <div style={{ fontWeight: 'bold', fontSize: INV_FONT, marginBottom: '3px' }}>Company's Bank Details</div>
                  <div
                    style={{
                      fontSize: INV_FONT,
                      lineHeight: '1.7',
                      fontWeight: 'bold'
                    }}
                  >
                    <div style={{ display: 'flex' }}>
                      <span style={{ width: '80px' }}>Bank Name</span>
                      <span>: {watch('bankName') || settings?.bankName || ''}</span>
                    </div>

                    <div style={{ display: 'flex' }}>
                      <span style={{ width: '80px' }}>A/c No.</span>
                      <span>: {watch('accountNumber') || settings?.accountNumber || ''}</span>
                    </div>

                    <div style={{ display: 'flex' }}>
                      <span style={{ width: '80px' }}>IFS Code</span>
                      <span>: {watch('branchIfsc') || settings?.branchIfsc || ''}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '10px', fontWeight: 'bold', fontSize: INV_FONT }}>Declaration</div>
                  <div style={{ fontSize: INV_FONT, lineHeight: '1.5', fontWeight: 'bold' }}>
                    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                  </div>
                </td>
                <td style={{ verticalAlign: 'top', padding: '6px 8px', textAlign: 'right' }}>
                  <div style={{ fontSize: INV_FONT, fontWeight: 'bold' }}>for {settings?.companyName || ''}</div>
                  <div style={{ marginTop: '80px', fontWeight: 'bold', fontSize: INV_FONT }}>Authorised Signatory</div>
                </td>
              </tr>

              {/* ── ROW 6 : Footer ── */}
              <tr style={{ borderTop: '1px solid #000' }}>
                <td colSpan={2} style={{ padding: '5px 8px', textAlign: 'center', fontSize: INV_FONT, letterSpacing: '1px', fontWeight: 'bold' }}>
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