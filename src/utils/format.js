export function formatCurrency(value) {
  const number = Number(value) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(number)
}

export function parseDateToIso(value) {
  if (!value) return ''
  const dateStr = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  const dmY = /^\d{2}-\d{2}-\d{4}$/.exec(dateStr)
  if (dmY) {
    return `${dmY[3]}-${dmY[2]}-${dmY[1]}`
  }
  const date = new Date(dateStr)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }
  return ''
}

export function formatDateDisplay(value) {
  if (!value) return ''
  const dateStr = String(value).trim()
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    return dateStr
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (iso) {
    return `${iso[3]}-${iso[2]}-${iso[1]}`
  }
  const date = new Date(dateStr)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('en-GB').replace(/\//g, '-')
  }
  return dateStr
}

const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertBelow1000(number) {
  let words = ''

  if (number >= 100) {
    words += `${units[Math.floor(number / 100)]} Hundred`
    number %= 100
  }

  if (number >= 20) {
    words += words ? ` ${tens[Math.floor(number / 10)]}` : tens[Math.floor(number / 10)]
    if (number % 10) {
      words += ` ${units[number % 10]}`
    }
  } else if (number >= 10) {
    words += words ? ` ${teens[number - 10]}` : teens[number - 10]
  } else if (number > 0) {
    words += words ? ` ${units[number]}` : units[number]
  }

  return words
}

function numberToWords(value) {
  if (value === 0) return 'Zero'

  const group1 = value % 1000
  let remaining = Math.floor(value / 1000)
  const group2 = remaining % 100
  remaining = Math.floor(remaining / 100)
  const group3 = remaining % 100
  remaining = Math.floor(remaining / 100)
  const group4 = remaining % 100

  const parts = []

  if (group4) {
    parts.push(`${convertBelow1000(group4)} Crore`)
  }

  if (group3) {
    parts.push(`${convertBelow1000(group3)} Lakh`)
  }

  if (group2) {
    parts.push(`${convertBelow1000(group2)} Thousand`)
  }

  if (group1) {
    parts.push(convertBelow1000(group1))
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function toIndianCurrency(value) {
  const amount = Number(value) || 0
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  const rupeesText = numberToWords(rupees)
  const paiseText = paise ? ` and ${numberToWords(paise)} Paise` : ''
  return `INR ${rupeesText}${paiseText} Only`
}
