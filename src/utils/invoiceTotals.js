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
  const taxableValue = items.reduce((sum, item) => sum + calculateLineItemAmount(item), 0)
  const taxAmount = items.reduce((sum, item) => sum + calculateLineItemTax(item), 0)
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
    totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    finalAmount: Number((rawTotal + roundOff).toFixed(2)),
  }
}
