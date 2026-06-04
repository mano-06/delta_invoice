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
      invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
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

  const findProductByName = (name) => {
    if (!name) return null
    const normalized = String(name).trim().toLowerCase()
    return products.find((item) => String(item.name || '').trim().toLowerCase() === normalized)
  }

  const saveItemProduct = async (index, createIfMissing = false) => {
    const item = items?.[index] || {}
    const description = String(item.description || '').trim()
    if (!description) return null

    const existing = findProductByName(description)
    if (existing) {
      setValue(`items.${index}.productId`, existing.id)
      setValue(`items.${index}.hsn`, existing.hsn || settings?.hsnSac || '')
      setValue(`items.${index}.rate`, Number(existing.rate || 0))
      setValue(`items.${index}.unit`, existing.unit || 'Pcs')
      setValue(`items.${index}.taxRate`, Number(existing.gstRate || 5))
      return existing
    }

    if (!createIfMissing) {
      return null
    }

    const newProduct = {
      name: description,
      hsn: item.hsn || settings?.hsnSac || '',
      rate: Number(item.rate || 0),
      gstRate: Number(item.taxRate || 5),
      unit: item.unit || 'Pcs',
    }

    const response = await api.saveProduct(newProduct)
    if (!response || !response.id) {
      return null
    }

    await loadProducts()
    setValue(`items.${index}.productId`, response.id)
    return response
  }

  const handleItemDescriptionChange = (index, value) => {
    setValue(`items.${index}.description`, value)

    const product = findProductByName(value)
    if (product) {
      setValue(`items.${index}.productId`, product.id)
      setValue(`items.${index}.hsn`, product.hsn || settings?.hsnSac || '')
      setValue(`items.${index}.rate`, Number(product.rate || 0))
      setValue(`items.${index}.unit`, product.unit || 'Pcs')
      setValue(`items.${index}.taxRate`, Number(product.gstRate || 5))
      return
    }

    setValue(`items.${index}.productId`, '')
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
      bankName: settings?.bankName || '',
      accountNumber: settings?.accountNumber || '',
      branchIfsc: settings?.branchIfsc || '',
      companyLogo: settings?.companyLogo || '',
    },
    invoice: {
      invoiceNumber: formValues.invoiceNumber || '',
      invoiceDate: formValues.invoiceDate || '',
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
      taxableValue: totals.taxableValue,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      totalAmount: totals.finalAmount,
      totalQuantity: totals.totalQuantity,
      amountWords: toIndianCurrency(totals.finalAmount),
      taxAmountWords: toIndianCurrency(totals.cgstAmount + totals.sgstAmount),
    },
  })

  const onSubmit = async (data) => {
    await Promise.all((items || []).map((_, index) => saveItemProduct(index, true)))

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
                        <input
                          type="text"
                          list={`product-search-${index}`}
                          value={currentItem.description || ''}
                          onChange={(event) => handleItemDescriptionChange(index, event.target.value)}
                          ref={(element) => {
                            descriptionRefs.current[index] = element
                          }}
                          onKeyDown={handleRowKeyDown}
                          className="min-w-[220px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                          placeholder="Search or type product description"
                        />
                        <datalist id={`product-search-${index}`}>
                          {products.map((product) => (
                            <option key={product.id} value={product.name} />
                          ))}
                        </datalist>
                      </td>
                      <td className="px-4 py-3">
                        <input
                              type="number"
                              min="0"
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                              onKeyDown={handleRowKeyDown}
                              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          {...register(`items.${index}.rate`, { valueAsNumber: true })}
                          onKeyDown={handleRowKeyDown}
                          className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
          <div className="mt-6 space-y-4 text-sm text-slate-700" style={{lineHeight:'1'}}>
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
            fontFamily: "'Fututa Cyrillic', 'Futura Cyrillic', 'Futura-Cyrillic', 'Futura PT', 'Futura', 'Jost', sans-serif",
            fontSize: '9px',
            color: '#000',
            fontWeight: '500',
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
            <div style={{ flex:1,width: '72px', minWidth: '72px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'left'}}>
              {settings?.companyLogo
                ? <img src={settings.companyLogo} alt="Logo" style={{ marginLeft:'10px',maxWidth: '250px', maxHeight: '180px', objectFit: 'contain', margin:'15px' }} />
                : <div style={{ width: '60px', height: '60px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#aaa', textAlign: 'center' }}>LOGO</div>
              }
            </div>
            <div style={{width: '38%', padding: '4px 10px', textAlign: 'left', fontSize: '12px', lineHeight: '1.4' }}>
              {settings?.address1 && <div>{settings.address1}</div>}
              {settings?.address2 && <div>{settings.address2}</div>}
              {(settings?.city || settings?.pincode) && (
                <div>{[settings?.city, settings?.pincode].filter(Boolean).join(' - ')}</div>
              )}
              {settings?.stateName && <div style={{ fontSize: '12px' }}>State Name : {settings.stateName}</div>}
              {settings?.email && <div>E-Mail : {settings.email}</div>}
              {settings?.gstin && <div style={{ fontSize: '13px' }}>GSTIN/UIN : {settings.gstin}</div>}
            </div>
          </div>

          {/* ── Buyer + Invoice meta: two-column row ── */}
          <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 0, minHeight:'107px'}}>
            <div style={{ display: 'flex', flexDirection: 'column',width: '55%', padding: '4px 8px', borderRight: '1px solid #000' ,lineHeight:'1.2'}}>
              <div style={{ flex: '1',fontWeight: 'bold', fontSize: '14px', marginBottom: '3px' }}>Buyer (Bill to)</div>
              <div style={{ fontWeight: '700', fontSize: '13px' }}>{formValues.buyerName}</div>
              <div style={{fontSize: '12px' }}>{formValues.buyerAddressLine1}</div>
              {formValues.buyerAddressLine2 && <div style={{fontSize: '12px' }}>{formValues.buyerAddressLine2}</div>}
              {formValues.buyerState && <div style={{ fontSize: '12px' }}>State Name : {formValues.buyerState}</div>}
              {formValues.buyerGstin && <div style={{ marginTop: '3px', fontSize: '12px' }}>GSTIN/UIN : {formValues.buyerGstin}</div>}
            </div>
            <div style={{ width: '45%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: '1', padding: '8px 6px', fontWeight: 'bold', fontSize: '20px', textAlign: 'center',marginBottom:'5px',marginTop: '5px' ,verticalAlign: 'middle'}}>TAX INVOICE</div>
                <div style={{ display: 'grid', gridTemplateColumns: '45% 55%', borderBottom: '1px solid #000',borderTop: '1px solid #000' }}>
                <div style={{ padding: '4px 6px', fontWeight: 'bold', fontSize: '12px', borderRight: '1px solid #000' }}>INVOICE NO.</div>
                <div style={{ padding: '4px 6px', fontWeight: 'bold', fontSize: '12px'}}>DATED</div>
                
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '45% 55%' }}>
                <div style={{ padding: '4px 6px', fontSize: '12px', borderRight: '1px solid #000', fontWeight: '500' }}>{formValues.invoiceNumber}</div>
                <div style={{ padding: '4px 6px', fontSize: '12px', fontWeight: '500'}}>{formValues.invoiceDate}</div>
                
              </div>
            </div>
          </div>

          {(() => {
            const cols = ['6%', '37%', '10%', '12%', '11%', '8%', '16%']
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
                      <th key={i} style={{ padding: '4px 5px', fontWeight: 'bold', fontSize: '12px', textAlign: i === 0 ? 'center' : i === 1 ? 'left' : 'right', borderRight: cellBorder(i), borderBottom: '1px solid #000', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Fixed-height body with always-visible column separators */}
                  <tr>
                    <td colSpan={7} style={{ padding: 0, height: '400px', verticalAlign: 'top', border: 0, position: 'relative' ,lineHeight:'1'}}>
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
                                { val: item.hsn || settings?.hsnSac || '', align: 'right' },
                                { val: item.quantity ? `${Number(item.quantity).toLocaleString('en-IN')} Pcs` : '', align: 'right' },
                                { val: item.rate ? Number(item.rate).toFixed(2) : '', align: 'right' },
                                { val: item.unit, align: 'right' },
                                { val: amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', align: 'right' },
                              ]
                              return (
                                <tr key={index}>
                                  {cells.map((cell, ci) => (
                                    <td key={ci} style={{ padding: '3px 5px', fontSize: '13px', fontWeight: '500', textAlign: cell.align, verticalAlign: 'top', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.val}</td>
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
                    <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px' }}></td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px', borderLeft: '1px solid #000' }}>
                      {Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px' }}>CGST 2.5%</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px', borderLeft: '1px solid #000' }}>
                      {Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px' }}>SGST 2.5%</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px', borderLeft: '1px solid #000' }}>
                      {Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {totals.roundOff !== 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px' }}>ROUND OFF</td>
                      <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '12px', borderLeft: '1px solid #000' }}>
                        {totals.roundOff < 0 ? '(-)' : '(+)'}{Math.abs(totals.roundOff).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={3} style={{ borderRight: '1px solid #000',textAlign: 'right', padding: '3px 5px', fontWeight: 'bold', fontSize: '13px' }}>Total</td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>
                      {totals.totalQuantity ? `${Number(totals.totalQuantity).toLocaleString('en-IN')} Pcs` : ''}
                    </td>
                    <td colSpan={2} style={{ padding: '3px 5px' }}></td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: '700', fontSize: '12px', borderLeft: '1px solid #000' }}>
                      Rs. {Number(totals.finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Amount in words */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: '4px 8px', lineHeight: '1' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Amount Chargeable (in words)</span>
                      <span style={{ float: 'right', fontSize: '12px' }}>E. &amp; O.E</span>
                      <div style={{ marginTop: '3px', fontWeight: '500', fontSize: '12px' }}>{toIndianCurrency(totals.finalAmount)}</div>
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
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '11px', textAlign: 'left', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} rowSpan={2}>HSN/SAC</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '11px', textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} rowSpan={2}>Taxable Value</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '11px', textAlign: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} colSpan={2}>Central Tax</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '11px', textAlign: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} colSpan={2}>State Tax</th>
                            <th style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid #000' }} rowSpan={2}>Total Tax Amount</th>
                          </tr>
                          <tr>
                            {['Rate', 'Amount', 'Rate', 'Amount'].map((h, i) => (
                              <th key={i} style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '11px', textAlign: 'right', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>{h}</th>
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
                                  <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'left', borderRight: '1px solid #000' }}>{hsn}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                  <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                  <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right' }}>{Number(cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              )
                            })
                          })()}
                          <tr style={{ borderTop: '1px solid #000' }}>
                            <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'left', borderRight: '1px solid #000' }}>Total</td>
                            <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                            <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                            <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', fontSize: '11px', fontWeight: '500', textAlign: 'right' }}>{Number(totals.cgstAmount + totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Tax amount in words */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: '3px 8px', fontSize: '12px', fontWeight: '500' }}>
                      <strong>Tax Amount (in words) :</strong> {toIndianCurrency(totals.cgstAmount + totals.sgstAmount)}
                    </td>
                  </tr>

                  {/* Bank + Signatory */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div style={{ display: 'flex' }}>
                        <div style={{ width: '55%', padding: '4px 8px', borderRight: '1px solid #000' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '6px',marginTop:'6px' }}>Company's Bank Details</div>
                          <div style={{ fontSize: '12px', lineHeight: '1.5'}}>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px',fontWeight: 'bold'  }}>Bank Name</span>
                              <span style={{fontWeight:'500'}}>: {settings?.bankName || ''}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px',fontWeight: 'bold' }}>A/c No.</span>
                              <span style={{fontWeight:'500'}}>: {settings?.accountNumber || ''}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px',fontWeight: 'bold' }}>IFS Code</span>
                              <span style={{fontWeight:'500'}}>: {settings?.branchIfsc || ''}</span>
                            </div>
                          </div>
                          
                        </div>
                        <div style={{ width: '45%', padding: '4px 8px', textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700' ,marginTop:'15px'}}>for {settings?.companyName || ''}</div>
                          <div style={{ marginTop: '40px', fontWeight: 'bold', fontSize: '12px' }}>Authorised Signatory</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )
          })()}

          <div style={{ padding: '2px 5px', textAlign:'center'}}>
            <div style={{ textTransform: 'uppercase',fontSize: '13px',fontWeight: 'bold' }}>SUBJECT TO TIRUPPUR JURISDICTION</div>
            <div style={{ marginTop: '2px', fontSize: '12px', fontWeight: '500' }}>This is a Computer Generated Invoice</div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default CreateInvoice