const isRowEmpty = (item) => {
  const desc = String(item?.description || '').trim()
  const qty = item?.quantity
  const rate = item?.rate
  return !desc && (qty === '' || qty === undefined || qty === null || isNaN(Number(qty))) && (rate === '' || rate === undefined || rate === null || isNaN(Number(rate)))
}

export function calculateLineItemAmount(item = {}) {
  const quantity = Number(item.quantity || 0)
  const rate = Number(item.rate || 0)
  return Number((quantity * rate).toFixed(2))
}

export function calculateLineItemTax(item = {}) {
  const taxRate = Number(item.taxRate || 5)
  return Number((calculateLineItemAmount(item) * (taxRate / 100)).toFixed(2))
}

export function calculateInvoiceTotals(items = []) {
  const safeItems = items.filter(item => !isRowEmpty(item))
  const taxableValue = safeItems.reduce((sum, item) => sum + calculateLineItemAmount(item), 0)
  const taxAmount = safeItems.reduce((sum, item) => sum + calculateLineItemTax(item), 0)
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
}
