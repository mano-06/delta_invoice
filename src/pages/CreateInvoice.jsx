import { useContext, useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'
import { api } from '../services/api'
import { downloadInvoicePdf, printInvoice } from '../pdf/invoicePdf'
import { formatCurrency, toIndianCurrency, formatDateDisplay } from '../utils/format'
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts'

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

function CreateInvoice() {
  const { customers, products, settings, loadCustomers, loadProducts } = useContext(AppContext)
  const [invoiceMeta, setInvoiceMeta] = useState(null)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const customerSelectRef = useRef(null)
  const descriptionRefs = useRef([])
  const quantityRefs = useRef([])
  const rateRefs = useRef([])
  const dropdownContainerRef = useRef(null)
  
  // Initialize keyboard shortcuts with dropdown state
  useKeyboardShortcuts({ isDropdownOpen: activeDropdown !== null })

  const { register, control, handleSubmit, watch, setValue, reset } = useForm({
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
      items: [
        {
          description: '',
          hsn: settings?.hsnSac || '',
          quantity: '',
          rate: '',
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
    const handlePageEnter = (event) => {
      if (event.key !== 'Enter') return
      const active = document.activeElement
      if (active === document.body || active === document.documentElement || active == null) {
        event.preventDefault()
        customerSelectRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handlePageEnter)
    return () => window.removeEventListener('keydown', handlePageEnter)
  }, [])

  useEffect(() => {
    if (!settings) return

    items?.forEach((item, index) => {
      if (!item?.hsn) {
        setValue(`items.${index}.hsn`, settings.hsnSac || '')
      }
    })
  }, [items, settings, setValue])

  const appendRow = () => {
    if (fields.length >= MAX_ITEMS) {
      toast.error(`Maximum ${MAX_ITEMS} items allowed per invoice`)
      return
    }
    const nextIndex = fields.length
    append({ description: '', hsn: settings?.hsnSac || '', quantity: '', rate: '', unit: 'Pcs', taxRate: 5, productId: '' })
    window.setTimeout(() => {
      descriptionRefs.current[nextIndex]?.focus()
    }, 0)
  }

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
      isComplete: numFilled === 3
    }
  }

  // Navigate: description → quantity → rate → new row (or next description if row exists)
  const handleDescriptionKeyDown = (event, index) => {
    const currentItem = items?.[index] || {}
    const filteredProducts = products
      .filter((product) =>
        product.name.toLowerCase().includes(currentItem.description?.toLowerCase() || '')
      )
      .slice(0, 5)

    // Handle Esc to close dropdown
    if (event.key === 'Escape') {
      if (activeDropdown === index) {
        event.preventDefault()
        setActiveDropdown(null)
        setDropdownSelectedIndex(0)
        descriptionRefs.current[index]?.focus()
      }
      return
    }

    // Handle dropdown arrow key navigation
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

    // Handle Enter key
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

      // If dropdown is open, select the highlighted product
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

      // Otherwise, move to quantity field (normal Enter behavior)
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
    if (allowedKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
      return
    }
    if (event.key === '.' && !event.target.value.includes('.')) {
      return
    }
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault()
    }
  }

  const handleRateKeyDown = (event, index) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        quantityRefs.current[index]?.focus()
        return
      }
      const status = getRowStatus(index)
      if (status.isIncomplete) {
        // One or two fields are missing: Do NOT move to next row
        return
      }
      if (status.isEmpty) {
        // All three fields are empty: Save invoice when pressing enter from Rate/Pcs (if customer is selected)
        if (!watch('buyerName')) {
          toast.error('Please select a customer first')
          return
        }
        handleSubmit(onSubmit)()
        return
      }
      // Row is complete: Move to next row's description
      const nextIndex = index + 1
      if (nextIndex < fields.length) {
        descriptionRefs.current[nextIndex]?.focus()
      } else {
        appendRow()
      }
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

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find((entry) => entry.id === Number(customerId))
    if (!customer) return
    setValue('buyerName', customer.name)
    const { buyerAddressLine1, buyerAddressLine2 } = splitBuyerAddress(customer.billingAddress)
    setValue('buyerAddressLine1', buyerAddressLine1)
    setValue('buyerAddressLine2', buyerAddressLine2)
    setValue('buyerGstin', customer.gstin)
    setValue('buyerState', customer.state)
    window.setTimeout(() => {
      descriptionRefs.current[0]?.focus()
    }, 0)
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
      setValue(`items.${index}.rate`, Number(existing.rate || ''))
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
      rate: Number(item.rate || ''),
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
      setValue(`items.${index}.rate`, Number(product.rate || ''))
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
      phoneNumber: settings?.phoneNumber || '',
      bankName: settings?.bankName || '',
      accountNumber: settings?.accountNumber || '',
      branchIfsc: settings?.branchIfsc || '',
      companyLogo: settings?.companyLogo || '',
    },
    invoice: {
      invoiceNumber: formValues.invoiceNumber || '',
      invoiceDate: formatDateDisplay(formValues.invoiceDate || ''),
      buyerName: formValues.buyerName || '',
      buyerAddress: joinBuyerAddress(formValues.buyerAddressLine1, formValues.buyerAddressLine2),
      buyerGstin: formValues.buyerGstin || '',
      buyerState: formValues.buyerState || '',
      amountWords: toIndianCurrency(totals.finalAmount),
    },
    items: (formValues.items || []).filter(item => !isRowEmpty(item)).map((item, index) => ({
      serial: index + 1,
      description: item.description || '',
      hsn: item.hsn || '',
      quantity: Number(item.quantity || ''),
      rate: Number(item.rate || ''),
      unit: item.unit || 'Pcs',
      amount: Number((Number(item.quantity || '') * Number(item.rate || '')).toFixed(2)),
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
    if (!data.buyerName) {
      toast.error('Please select a customer first')
      return
    }

    const nonEvItems = (data.items || []).filter(item => !isRowEmpty(item))
    if (nonEvItems.length === 0) {
      toast.error('Please add at least one item to the invoice')
      return
    }

    // Save/Associate products for all non-empty items
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

          // If current details differ from catalog, update the product
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
    await loadProducts()

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
      items: nonEvItems.map((item, index) => ({
        serial: index + 1,
        description: item.description,
        hsn: item.hsn,
        quantity: Number(item.quantity || ''),
        rate: Number(item.rate || ''),
        unit: item.unit || 'Pcs',
        amount: Number((Number(item.quantity || '') * Number(item.rate || '')).toFixed(2)),
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
  const INV_FONT = '9px'
  const ITEMS_BODY_HEIGHT = '420px'

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
                  ref={customerSelectRef}
                  onChange={(event) => handleCustomerSelect(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="">Choose existing customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
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
                {/* Sl No */}
                <col style={{ minWidth: '50px', width: '6%' }} />
                {/* Description */}
                <col style={{ minWidth: '220px', width: '34%' }} />
                {/* Quantity */}
                <col style={{ minWidth: '120px', width: '16%' }} />
                {/* Rate */}
                <col style={{ minWidth: '120px', width: '16%' }} />
                {/* Amount */}
                <col style={{ minWidth: '120px', width: '16%' }} />
                {/* Action */}
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
                  return (
                    <tr key={field.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{index + 1}</td>
                      <td className="px-4 py-3 relative overflow-visible">
                        <input
                          type="text"
                          value={currentItem.description || ''}
                          onChange={(event) => {
                            const newValue = event.target.value
                            handleItemDescriptionChange(index, newValue)
                            setDropdownSelectedIndex(0) // Reset dropdown selection
                            // Only show dropdown if there's at least 1 character
                            if (newValue.trim().length > 0) {
                              setActiveDropdown(index)
                            } else {
                              setActiveDropdown(null)
                            }
                          }}
                          onFocus={() => {
                            // Only open dropdown if description has at least 1 character
                            if (currentItem.description && String(currentItem.description).trim().length > 0) {
                              setActiveDropdown(index)
                            }
                          }}
                          onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                          ref={(element) => {
                            descriptionRefs.current[index] = element
                          }}
                          onKeyDown={(event) => handleDescriptionKeyDown(event, index)}
                          className="min-w-[200px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                          placeholder="Search or type product description"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const quantityRegister = register(`items.${index}.quantity`, { valueAsNumber: true })
                          const quantityRef = quantityRegister.ref
                          return (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              {...quantityRegister}
                              ref={(element) => {
                                quantityRefs.current[index] = element
                                if (typeof quantityRef === 'function') {
                                  quantityRef(element)
                                } else if (quantityRef) {
                                  quantityRef.current = element
                                }
                              }}
                              onKeyDown={(event) => {
                                handleNumericKeyDown(event)
                                handleQuantityKeyDown(event, index)
                              }}
                              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const rateRegister = register(`items.${index}.rate`, { valueAsNumber: true })
                          const rateRef = rateRegister.ref
                          return (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              {...rateRegister}
                              ref={(element) => {
                                rateRefs.current[index] = element
                                if (typeof rateRef === 'function') {
                                  rateRef(element)
                                } else if (rateRef) {
                                  rateRef.current = element
                                }
                              }}
                              onKeyDown={(event) => {
                                handleNumericKeyDown(event)
                                handleRateKeyDown(event, index)
                              }}
                              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          )
                        })()}
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

          {/* Floating Dropdown Container */}
          {activeDropdown !== null && descriptionRefs.current[activeDropdown] && (() => {
            const currentItem = items?.[activeDropdown] || {}
            const description = String(currentItem.description || '').trim()
            
            // Only show dropdown if description has at least 1 character
            if (description.length === 0) {
              return null
            }
            
            const filteredProducts = products
              .filter((product) =>
                product.name.toLowerCase().includes(description.toLowerCase())
              )
              .slice(0, 5)

            if (filteredProducts.length === 0) return null

            return (
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
                <div className="max-h-40 overflow-y-auto">
                  {filteredProducts.map((product, idx) => (
                    <div
                      key={product.id}
                      className={`px-3 py-2 cursor-pointer text-sm ${
                        idx === dropdownSelectedIndex
                          ? 'bg-slate-200 text-slate-900 font-medium'
                          : 'hover:bg-gray-100 text-slate-900'
                      }`}
                      onMouseDown={() => {
                        const selectedIndex = activeDropdown
                        handleItemDescriptionChange(selectedIndex, product.name)
                        setActiveDropdown(null)
                        setDropdownSelectedIndex(0)
                        window.setTimeout(() => {
                          quantityRefs.current[selectedIndex]?.focus()
                        }, 0)
                      }}
                      onMouseEnter={() => {
                        setDropdownSelectedIndex(idx)
                      }}
                    >
                      {product.name}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
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
    </div>
  )
}

export default CreateInvoice