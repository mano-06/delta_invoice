import { useContext, useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'
import { api } from '../services/api'
import { downloadInvoicePdf, printInvoice } from '../pdf/invoicePdf'
import { formatCurrency, toIndianCurrency, formatDateDisplay, parseDateToIso } from '../utils/format'
import { blurActiveElement } from '../utils/focusManagement'
import useBackspaceNavigation from '../hooks/useBackspaceNavigation'

const MAX_ITEMS = 20

const splitBuyerAddress = (value = '') => {
  const lines = String(value || '').split(/\r?\n/).map((line) => line.trim())
  return {
    buyerAddressLine1: lines[0] || '',
    buyerAddressLine2: lines.slice(1).join(' ').trim(),
  }
}

const joinBuyerAddress = (line1 = '', line2 = '') => [line1.trim(), line2.trim()].filter(Boolean).join('\n')

const isRowEmpty = (item) => {
  const desc = String(item?.description || '').trim()
  const qty = item?.quantity
  const rate = item?.rate
  return !desc && (qty === '' || qty === undefined || qty === null || isNaN(Number(qty))) && (rate === '' || rate === undefined || rate === null || isNaN(Number(rate)))
}

function InvoicePreview() {
  const id = useParams().id
  const navigate = useNavigate()
  const { settings, customers, products, loadCustomers, loadProducts } = useContext(AppContext)
  const [invoice, setInvoice] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(0)
  const dropdownContainerRef = useRef(null)
  useBackspaceNavigation({ isDropdownOpen: activeDropdown !== null })

  useEffect(() => {
    loadCustomers()
    loadProducts()
  }, [])

  const { register, control, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: {
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
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

  const customerSelectRef = useRef(null)
  const descriptionRefs = useRef([])
  const quantityRefs = useRef([])
  const rateRefs = useRef([])

  useEffect(() => {
    descriptionRefs.current = descriptionRefs.current.slice(0, fields.length)
    quantityRefs.current = quantityRefs.current.slice(0, fields.length)
    rateRefs.current = rateRefs.current.slice(0, fields.length)
  }, [fields.length])

  useEffect(() => {
    if (activeDropdown !== null && activeDropdown >= fields.length) {
      setActiveDropdown(null)
    }
  }, [fields.length, activeDropdown])

  const handleRemoveItem = (index) => {
    remove(index)
    descriptionRefs.current.splice(index, 1)
    quantityRefs.current.splice(index, 1)
    rateRefs.current.splice(index, 1)
    if (activeDropdown !== null && activeDropdown >= index) {
      setActiveDropdown(null)
    }
  }

  const appendRow = () => {
    if (fields.length >= MAX_ITEMS) {
      toast.error(`Maximum ${MAX_ITEMS} items allowed per invoice`)
      return
    }
    const nextIndex = fields.length
    append({ description: '', hsn: settings?.hsnSac || '', quantity: '', rate: '', unit: 'Pcs' })
    window.setTimeout(() => {
      descriptionRefs.current[nextIndex]?.focus()
    }, 0)
  }

  const handleDescriptionKeyDown = (event, index) => {
    const currentItem = items?.[index] || {}
    const filteredProducts = products
      .filter((product) =>
        product.name.toLowerCase().includes(currentItem.description?.toLowerCase() || '')
      )
      .slice(0, 5)

    if (event.key === 'Escape') {
      if (activeDropdown === index) {
        event.preventDefault()
        setActiveDropdown(null)
        setDropdownSelectedIndex(0)
        descriptionRefs.current[index]?.focus()
      }
      return
    }

    if (activeDropdown === index && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      if (filteredProducts.length === 0) return

      if (event.key === 'ArrowDown') {
        setDropdownSelectedIndex((prev) => (prev + 1) % filteredProducts.length)
      } else {
        setDropdownSelectedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length)
      }
      return
    }

    if (event.key === 'Enter') {
      if (event.shiftKey) {
        event.preventDefault()
        if (index > 0) {
          rateRefs.current[index - 1]?.focus()
        } else {
          customerSelectRef.current?.focus()
        }
        return
      }

      if (activeDropdown === index && filteredProducts.length > 0) {
        event.preventDefault()
        const selectedProduct = filteredProducts[dropdownSelectedIndex]
        handleItemDescriptionChange(index, selectedProduct.name)
        setActiveDropdown(null)
        setDropdownSelectedIndex(0)
        window.setTimeout(() => {
          quantityRefs.current[index]?.focus()
        }, 0)
        return
      }

      event.preventDefault()
      quantityRefs.current[index]?.focus()
    }
  }

  const handleQuantityKeyDown = (event, index) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        descriptionRefs.current[index]?.focus()
        return
      }
      rateRefs.current[index]?.focus()
    }
  }

  const handleNumericKeyDown = (event) => {
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End', 'Copy', 'Paste']
    if (allowedKeys.includes(event.key) || event.ctrlKey || event.metaKey) return
    if (event.key === '.' && !event.target.value.includes('.')) return
    if (!/[0-9]/.test(event.key)) event.preventDefault()
  }

  const handleRateKeyDown = (event, index) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        quantityRefs.current[index]?.focus()
        return
      }
      const status = getRowStatus(index)
      if (status.isIncomplete) return
      if (status.isEmpty) {
        if (!watch('buyerName')) {
          toast.error('Please select a customer first')
          return
        }
        handleSubmit(onSave)()
        return
      }
      const nextIndex = index + 1
      if (nextIndex < fields.length) {
        descriptionRefs.current[nextIndex]?.focus()
      } else if (fields.length >= MAX_ITEMS && index === MAX_ITEMS - 1) {
        handleSubmit(onSave)()
      } else {
        appendRow()
      }
    }
  }

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
    return products.find((p) => String(p.name || '').trim().toLowerCase() === normalized)
  }

  const handleItemDescriptionChange = (index, value) => {
    setValue(`items.${index}.description`, value)
    const product = findProductByName(value)
    if (product) {
      setValue(`items.${index}.productId`, product.id)
      setValue(`items.${index}.hsn`, product.hsn || settings?.hsnSac || '')
      setValue(`items.${index}.rate`, Number(product.rate || ''))
      setValue(`items.${index}.unit`, product.unit || 'Pcs')
      setValue(`items.${index}.taxRate`, Number(product.gstRate || 5))
      return
    }
    setValue(`items.${index}.productId`, '')
  }

  useEffect(() => {
    loadInvoice()
  }, [id])

  useEffect(() => {
    if (!invoice) return
    reset(mapInvoiceToForm(invoice))
  }, [invoice, reset])

  const mapInvoiceToForm = (record) => ({
    invoiceNumber: record.invoiceNumber || '',
    invoiceDate: parseDateToIso(record.invoiceDate || new Date().toISOString().slice(0, 10)),
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

  const getRowStatus = (index) => {
    const item = items?.[index] || {}
    const desc = String(item.description || '').trim()
    const qty = item.quantity
    const rate = item.rate
    const hasDesc = !!desc
    const hasQty = !(qty === '' || qty === undefined || qty === null || isNaN(Number(qty)))
    const hasRate = !(rate === '' || rate === undefined || rate === null || isNaN(Number(rate)))
    const numFilled = (hasDesc ? 1 : 0) + (hasQty ? 1 : 0) + (hasRate ? 1 : 0)
    return {
      isEmpty: numFilled === 0,
      isIncomplete: numFilled > 0 && numFilled < 3,
      isComplete: numFilled === 3,
    }
  }

  const totals = (() => {
    const safeItems = (items || []).filter(item => !isRowEmpty(item))
    const taxableValue = safeItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0)
    const taxAmount = safeItems.reduce((sum, item) => {
      const taxRate = Number(item.taxRate || 5)
      return sum + (Number(item.quantity || 0) * Number(item.rate || 0) * taxRate) / 100
    }, 0)
    const cgstAmount = Number((taxAmount / 2).toFixed(2))
    const sgstAmount = Number((taxAmount / 2).toFixed(2))
    const rawTotal = Number((taxableValue + cgstAmount + sgstAmount).toFixed(2))
    const roundedTotal = Math.round(rawTotal)
    const roundOff = Number((roundedTotal - rawTotal).toFixed(2))
    return {
      taxableValue,
      cgstAmount,
      sgstAmount,
      roundOff,
      totalQuantity: safeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      finalAmount: roundedTotal,
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

  const displayInvoiceDate = formatDateDisplay(formValues.invoiceDate || invoice?.invoiceDate || '')

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
        phoneNumber: settings?.phoneNumber || '',
        bankName: settings?.bankName || '',
        accountNumber: settings?.accountNumber || '',
        branchIfsc: settings?.branchIfsc || '',
        companyLogo: settings?.companyLogo || '',
      },
      invoice: {
        invoiceNumber: formValues.invoiceNumber || invoice?.invoiceNumber || '',
        invoiceDate: displayInvoiceDate,
        buyerName: formValues.buyerName || invoice?.buyerName || '',
        buyerAddress: joinBuyerAddress(formValues.buyerAddressLine1, formValues.buyerAddressLine2),
        buyerGstin: formValues.buyerGstin || invoice?.buyerGstin || '',
        buyerState: formValues.buyerState || invoice?.buyerState || '',
        amountWords: toIndianCurrency(totals.finalAmount),
      },
      items: (items || []).filter(item => !isRowEmpty(item)).map((item) => ({
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
        taxAmountWords: toIndianCurrency(cgstAmt + sgstAmt),
        noGstAmountWords: toIndianCurrency(totals.taxableValue),
      },
    }
  }

  const onSave = async (data) => {
    if (!invoice) return
    if (!data.buyerName) {
      toast.error('Please select a customer first')
      return
    }
    const nonEvItems = (data.items || []).filter(item => !isRowEmpty(item))
    if (nonEvItems.length === 0) {
      toast.error('Please add at least one item to the invoice')
      return
    }
    setIsSaving(true)
    try {
      await Promise.all(
        nonEvItems.map(async (item) => {
          const description = String(item.description || '').trim()
          if (!description) return
          const existing = findProductByName(description)
          const itemRate = Number(item.rate || 0)
          const itemGst = Number(item.taxRate || 5)
          const itemUnit = item.unit || 'Pcs'
          if (existing) {
            item.productId = existing.id
            item.hsn = existing.hsn || settings?.hsnSac || ''
            item.rate = itemRate
            item.unit = itemUnit
            item.taxRate = itemGst
            if (
              Number(existing.rate || 0) !== itemRate ||
              Number(existing.gstRate || 0) !== itemGst ||
              (existing.unit || 'Pcs') !== itemUnit
            ) {
              await api.updateProduct(existing.id, {
                name: existing.name,
                hsn: existing.hsn,
                rate: itemRate,
                gstRate: itemGst,
                unit: itemUnit,
              })
            }
          } else {
            const newProduct = {
              name: description,
              hsn: item.hsn || settings?.hsnSac || '',
              rate: itemRate,
              gstRate: itemGst,
              unit: itemUnit,
            }
            const response = await api.saveProduct(newProduct)
            if (response && response.id) {
              item.productId = response.id
            }
          }
        })
      )
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
        items: nonEvItems.map((item, index) => ({
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
      blurActiveElement()
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (!invoice) return
    reset(mapInvoiceToForm(invoice))
    setIsEditing(false)
  }

  const invoiceFilename = () => `${formValues.invoiceNumber || invoice?.invoiceNumber || 'invoice'}.pdf`

  if (!invoice) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-card">
        Loading invoice preview…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header bar ── */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Invoice Preview</h2>
          <p className="mt-1 text-sm text-slate-500">Review, print or download the A4 invoice, and edit the saved invoice when needed.</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
          <button
            type="button"
            onClick={() => navigate('/invoice-history')}
            className="rounded-full bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to History
          </button>
        </div>
      </div>

      {/* ── Edit form ── */}
      {isEditing && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Edit Invoice</h3>
              <p className="mt-1 text-sm text-slate-500">Update the invoice header, buyer details and line items, then save.</p>
            </div>

            <form onSubmit={handleSubmit(onSave)} className="space-y-6">
              {/* Invoice number + date */}
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

              {/* Buyer details */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Select Customer
                  <select
                    ref={customerSelectRef}
                    onChange={(event) => handleCustomerSelect(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    <option value="">Choose existing customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </label>
                
              </div>

              {/* ── Line Items — same table layout as CreateInvoice ── */}
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Invoice Items</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Press Enter to move between fields. Max {MAX_ITEMS} items.{' '}
                      <span className={fields.length >= MAX_ITEMS ? 'font-semibold text-red-500' : 'text-slate-400'}>
                        {fields.length}/{MAX_ITEMS} used
                      </span>
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-visible">
                  <table className="min-w-full invoice-table border-separate border-spacing-0 bg-white text-left text-sm shadow-sm" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ minWidth: '50px', width: '6%' }} />
                      <col style={{ minWidth: '220px', width: '34%' }} />
                      <col style={{ minWidth: '120px', width: '16%' }} />
                      <col style={{ minWidth: '120px', width: '16%' }} />
                      <col style={{ minWidth: '120px', width: '16%' }} />
                      <col style={{ minWidth: '100px', width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="px-4 py-3">Sl No.</th>
                        <th className="px-4 py-3">Description of Goods</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Rate/Pcs</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => {
                        const quantity = Number(items?.[index]?.quantity || '')
                        const rate = Number(items?.[index]?.rate || '')
                        const amount = Number((quantity * rate).toFixed(2))
                        const currentItem = items?.[index] || {}

                        const quantityRegister = register(`items.${index}.quantity`, { valueAsNumber: true })
                        const quantityRef = quantityRegister.ref
                        const rateRegister = register(`items.${index}.rate`, { valueAsNumber: true })
                        const rateRef = rateRegister.ref

                        return (
                          <tr key={field.id}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{index + 1}</td>
                            <td className="px-4 py-3 relative overflow-visible">
                              <input
                                type="text"
                                value={currentItem.description || ''}
                                onChange={(event) => {
                                  handleItemDescriptionChange(index, event.target.value)
                                  setActiveDropdown(index)
                                  setDropdownSelectedIndex(0)
                                }}
                                onFocus={() => {
                                  setActiveDropdown(index)
                                  setDropdownSelectedIndex(0)
                                }}
                                onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                                ref={(element) => { descriptionRefs.current[index] = element }}
                                onKeyDown={(event) => handleDescriptionKeyDown(event, index)}
                                className="min-w-[200px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                placeholder="Search or type product description"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                {...quantityRegister}
                                ref={(element) => {
                                  quantityRefs.current[index] = element
                                  if (typeof quantityRef === 'function') quantityRef(element)
                                  else if (quantityRef) quantityRef.current = element
                                }}
                                onKeyDown={(event) => {
                                  handleNumericKeyDown(event)
                                  handleQuantityKeyDown(event, index)
                                }}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                {...rateRegister}
                                ref={(element) => {
                                  rateRefs.current[index] = element
                                  if (typeof rateRef === 'function') rateRef(element)
                                  else if (rateRef) rateRef.current = element
                                }}
                                onKeyDown={(event) => {
                                  handleNumericKeyDown(event)
                                  handleRateKeyDown(event, index)
                                }}
                                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatCurrency(amount)}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (index === 0) return
                                  handleRemoveItem(index)
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

                {fields.length < MAX_ITEMS && (
                  <button
                    type="button"
                    onClick={appendRow}
                    className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
                  >
                    + Add Item
                  </button>
                )}

                {/* Floating product search dropdown */}
                {activeDropdown !== null && descriptionRefs.current[activeDropdown] && (
                  <div
                    ref={dropdownContainerRef}
                    style={{
                      position: 'fixed',
                      top: `${descriptionRefs.current[activeDropdown]?.getBoundingClientRect().bottom + 4}px`,
                      left: `${descriptionRefs.current[activeDropdown]?.getBoundingClientRect().left}px`,
                      width: `${descriptionRefs.current[activeDropdown]?.getBoundingClientRect().width}px`,
                      zIndex: 9999,
                    }}
                    className="rounded-lg border bg-white shadow-lg"
                  >
                    {(() => {
                      const currentItem = items?.[activeDropdown] || {}
                      const filteredProducts = products
                        .filter((product) =>
                          product.name.toLowerCase().includes(currentItem.description?.toLowerCase() || '')
                        )
                        .slice(0, 5)
                      if (filteredProducts.length === 0) return null
                      return (
                        <div className="max-h-40 overflow-y-auto">
                          {filteredProducts.map((product, idx) => {
                            const selected = idx === dropdownSelectedIndex
                            return (
                              <div
                                key={product.id}
                                className={`px-3 py-2 cursor-pointer text-sm text-slate-900 ${selected ? 'bg-slate-100' : 'hover:bg-gray-100'}`}
                                onMouseDown={() => {
                                  const selectedIndex = activeDropdown
                                  handleItemDescriptionChange(selectedIndex, product.name)
                                  setActiveDropdown(null)
                                  setDropdownSelectedIndex(0)
                                  window.setTimeout(() => {
                                    quantityRefs.current[selectedIndex]?.focus()
                                  }, 0)
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(idx)}
                              >
                                {product.name}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </section>

              {/* Save / Cancel buttons */}
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

      {/* ── INVOICE PRINT PREVIEW ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card overflow-x-auto">
        <div
          id="invoice-preview"
          className="invoice-sheet"
          style={{
            fontFamily: 'Jost',
            fontSize: '9px',
            color: '#000',
            fontWeight: '500',
            fontSynthesis: 'none',
            letterSpacing: '-0.015em',
            width: '210mm',
            minHeight: '257mm',
            margin: '0 auto',
            padding: '0mm 6mm',
            boxSizing: 'border-box',
            backgroundColor: '#fff',
          }}
        >
          {/* Company header */}
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
                <div>{settings.city}, {[settings?.stateName, settings?.pincode].filter(Boolean).join(' - ')}</div>
              )}
              {settings?.email && <div>E-Mail : {settings.email}</div>}
              {(settings?.phoneNumber || settings?.phone) && (
                <div>Mobile : {settings.phoneNumber || settings.phone}</div>
              )}
              {settings?.gstin && <div style={{ fontSize: '14px' }}>GSTIN/UIN : {settings.gstin}</div>}
            </div>
          </div>

          {/* Buyer + Invoice meta */}
          <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 0, minHeight: '107px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '55%', padding: '4px 8px', borderRight: '1px solid #000', lineHeight: '1.4' }}>
              <div style={{ flex: '1', fontWeight: 'bold', fontSize: '13px', marginBottom: '3px' }}>Buyer (Bill to)</div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>{formValues.buyerName}</div>
              <div style={{ fontSize: '13px' }}>{formValues.buyerAddressLine1}</div>
              {formValues.buyerAddressLine2 && <div style={{ fontSize: '13px' }}>{formValues.buyerAddressLine2}</div>}
              {formValues.buyerState && <div style={{ fontSize: '13px' }}>{formValues.buyerState}</div>}
              {formValues.buyerGstin && <div style={{ marginTop: '3px', fontSize: '14px' }}>GSTIN/UIN : {formValues.buyerGstin}</div>}
            </div>
            <div style={{ width: '45%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: '1', padding: '4px 6px', fontWeight: 'bold', fontSize: '20px', textAlign: 'center', marginBottom: '3px', marginTop: '9px' }}>TAX INVOICE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '44.5% 55.5%', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <div style={{ padding: '8px 6px', fontWeight: 'bold', fontSize: '13px', borderRight: '1px solid #000' }}>INVOICE NO.</div>
                <div style={{ padding: '8px 6px', fontWeight: 'bold', fontSize: '13px' }}>DATED</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '44.5% 55.5%' }}>
                <div style={{ padding: '8px 6px', fontSize: '13px', borderRight: '1px solid #000', fontWeight: '500' }}>{formValues.invoiceNumber}</div>
                <div style={{ padding: '8px 6px', fontSize: '13px', fontWeight: '500' }}>{displayInvoiceDate}</div>
              </div>
            </div>
          </div>

          {(() => {
            const cols = ['6%', '45%', '11%', '13%', '10%', '15%']
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
                    {['Sl No.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate/Pcs', 'Amount'].map((h, i) => (
                      <th key={i} style={{ padding: '4px 5px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', borderRight: cellBorder(i), borderBottom: '1px solid #000', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} style={{ padding: 0, height: '396px', verticalAlign: 'top', border: 0, position: 'relative', lineHeight: '1' }}>
                      <table style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        {colGroup}
                        <tbody>
                          <tr style={{ height: '396px' }}>
                            {cols.map((_, i) => (
                              <td key={i} style={{ borderRight: cellBorder(i), padding: 0 }}></td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ position: 'relative', overflow: 'hidden', height: '396px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          {colGroup}
                          <tbody>
                            {(items || []).filter(item => !isRowEmpty(item)).map((item, index) => {
                              const amount = Number(item.quantity || 0) * Number(item.rate || 0)
                              const cells = [
                                { val: index + 1, align: 'center' },
                                { val: item.description, align: 'left' },
                                { val: item.hsn || settings?.hsnSac || '', align: 'center' },
                                { val: item.quantity ? `${Number(item.quantity).toLocaleString('en-IN')} Pcs` : '', align: 'right' },
                                { val: item.rate ? Number(item.rate).toFixed(2) : '', align: 'right' },
                                { val: amount ? Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', align: 'right' },
                              ]
                              return (
                                <tr key={index}>
                                  {cells.map((cell, ci) => (
                                    <td key={ci} style={{ padding: '3px 5px', fontSize: '13px', fontWeight: '500', textAlign: cell.align, verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{cell.val}</td>
                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>

                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={5} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px' }}></td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      {Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px' }}>CGST 2.5%</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      {Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px' }}>SGST 2.5%</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      {Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {totals.roundOff !== 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px' }}>ROUND OFF</td>
                      <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: '500', fontSize: '13px', borderLeft: '1px solid #000' }}>
                        {totals.roundOff < 0 ? '(-)' : '(+)'}{Math.abs(totals.roundOff).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={3} style={{ borderRight: '1px solid #000', textAlign: 'right', padding: '3px 5px', fontWeight: 'bold', fontSize: '13px' }}>Total</td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
                      {totals.totalQuantity ? `${Number(totals.totalQuantity).toLocaleString('en-IN')} Pcs` : ''}
                    </td>
                    <td colSpan={1} style={{ padding: '3px 5px' }}></td>
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: '700', fontSize: '13px', borderLeft: '1px solid #000' }}>
                      Rs. {Number(totals.finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: '4px 8px', lineHeight: '1' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Amount Chargeable (in words)</span>
                      <span style={{ float: 'right', fontSize: '13px' }}>E. &amp; O.E</span>
                      <div style={{ marginTop: '3px', fontWeight: '500', fontSize: '13px' }}>{toIndianCurrency(totals.finalAmount)}</div>
                    </td>
                  </tr>

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
                            ;(items || []).forEach((item) => {
                              const hsn = item.hsn || 'N/A'
                              hsnMap[hsn] = (hsnMap[hsn] || 0) + Number(item.quantity || 0) * Number(item.rate || 0)
                            })
                            return Object.entries(hsnMap).map(([hsn, taxable]) => {
                              const cgst = Number((taxable * 0.025).toFixed(2))
                              const sgst = Number((taxable * 0.025).toFixed(2))
                              return (
                                <tr key={hsn} style={{ borderBottom: '1px solid #000' }}>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'left', borderRight: '1px solid #000' }}>{hsn}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>2.50%</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right' }}>{Number(cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              )
                            })
                          })()}
                          <tr style={{ borderTop: '1px solid #000' }}>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'left', borderRight: '1px solid #000' }}>Total</td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', borderRight: '1px solid #000' }}></td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right', borderRight: '1px solid #000' }}>{Number(totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '2px 5px', fontSize: '12px', fontWeight: '500', textAlign: 'right' }}>{Number(totals.cgstAmount + totals.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: '3px 8px', fontSize: '13px', fontWeight: '500' }}>
                      <strong>Tax Amount (in words) :</strong> {toIndianCurrency(totals.cgstAmount + totals.sgstAmount)}
                    </td>
                  </tr>

                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div style={{ display: 'flex' }}>
                        <div style={{ width: '55%', padding: '4px 8px', borderRight: '1px solid #000' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', marginTop: '6px' }}>Company's Bank Details</div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px', fontWeight: 'bold' }}>Bank Name</span>
                              <span style={{ fontWeight: '500' }}>: {settings?.bankName || ''}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px', fontWeight: 'bold' }}>A/c No.</span>
                              <span style={{ fontWeight: '500' }}>: {settings?.accountNumber || ''}</span>
                            </div>
                            <div style={{ display: 'flex' }}>
                              <span style={{ width: '80px', fontWeight: 'bold' }}>IFS Code</span>
                              <span style={{ fontWeight: '500' }}>: {settings?.branchIfsc || ''}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ width: '45%', padding: '4px 8px', textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '10px' }}>for {settings?.companyName || ''}</div>
                          <div style={{ marginTop: '32px',marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>Authorised Signatory</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )
          })()}

          <div style={{ padding: '2px 5px 4px', textAlign: 'center', marginTop: '2px' }}>
            <div style={{ textTransform: 'uppercase', fontSize: '13px', fontWeight: 'bold' }}>SUBJECT TO TIRUPPUR JURISDICTION</div>
            <div style={{ marginTop: '2px', fontSize: '13px', fontWeight: '500' }}>This is a Computer Generated Invoice</div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default InvoicePreview