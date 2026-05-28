const FALLBACK_STORAGE_KEY = 'delta-invoice-fallback-store'
const FALLBACK_BACKUP_KEY = 'delta-invoice-fallback-backup'

const defaultSettings = {
  companyName: '',
  address1: '',
  address2: '',
  city: '',
  pincode: '',
  gstin: '',
  stateName: '',
  email: '',
  phone: '',
  bankName: '',
  accountNumber: '',
  branchIfsc: '',
  hsnSac: '',
}

const createFallbackStore = () => ({
  settings: { ...defaultSettings },
  customers: [],
  products: [],
  invoices: [],
  sequence: 0,
})

const readFallbackStore = () => {
  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY)
    if (!raw) {
      return createFallbackStore()
    }

    const parsed = JSON.parse(raw)

    return {
      settings: { ...defaultSettings, ...(parsed.settings || {}) },
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      sequence: Number(parsed.sequence || 0),
    }
  } catch {
    return createFallbackStore()
  }
}

const writeFallbackStore = (store) => {
  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(store))
  return store
}

const getNextFallbackSequence = (store) => Number(store.sequence || 0) + 1

const formatFallbackInvoiceNumber = (nextSequence) => `DD/${nextSequence}`

const downloadJsonFile = (filename, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const fallbackInvoke = async (channel, payload) => {
  const store = readFallbackStore()

  switch (channel) {
    case 'app:getSettings':
      return store.settings

    case 'app:saveSettings': {
      store.settings = {
        ...defaultSettings,
        ...store.settings,
        ...(payload || {}),
      }
      writeFallbackStore(store)
      return store.settings
    }

    case 'app:getCustomers':
      return [...store.customers].sort((a, b) => Number(b.id) - Number(a.id))

    case 'app:saveCustomer': {
      const nextId = () => store.customers.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1
      const customer = payload || {}
      const normalized = {
        ...customer,
      }

      if (normalized.id) {
        const index = store.customers.findIndex((item) => Number(item.id) === Number(normalized.id))
        if (index !== -1) {
          store.customers[index] = { ...store.customers[index], ...normalized }
        }
      } else {
        store.customers.push({ ...normalized, id: nextId() })
      }

      writeFallbackStore(store)
      return normalized.id
        ? store.customers.find((item) => Number(item.id) === Number(normalized.id))
        : store.customers[store.customers.length - 1]
    }

    case 'app:deleteCustomer': {
      store.customers = store.customers.filter((item) => Number(item.id) !== Number(payload))
      writeFallbackStore(store)
      return { deleted: true }
    }

    case 'app:getProducts':
      return [...store.products].sort((a, b) => Number(b.id) - Number(a.id))

    case 'app:saveProduct': {
      const nextId = () => store.products.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1
      const product = payload || {}
      const normalized = {
        ...product,
        hsn: '',
        gstRate: 0,
        unit: '',
      }

      if (normalized.id) {
        const index = store.products.findIndex((item) => Number(item.id) === Number(normalized.id))
        if (index !== -1) {
          store.products[index] = { ...store.products[index], ...normalized }
        }
      } else {
        store.products.push({ ...normalized, id: nextId() })
      }

      writeFallbackStore(store)
      return normalized.id
        ? store.products.find((item) => Number(item.id) === Number(normalized.id))
        : store.products[store.products.length - 1]
    }

    case 'app:deleteProduct': {
      store.products = store.products.filter((item) => Number(item.id) !== Number(payload))
      writeFallbackStore(store)
      return { deleted: true }
    }

    case 'app:getInvoices': {
      const filtered = payload?.customerName
        ? store.invoices.filter((item) => String(item.buyerName || '').toLowerCase().includes(String(payload.customerName).toLowerCase()))
        : store.invoices
      return [...filtered].sort((a, b) => Number(b.id) - Number(a.id))
    }

    case 'app:getInvoiceById': {
      return store.invoices.find((item) => Number(item.id) === Number(payload)) || null
    }

    case 'app:saveInvoice': {
      const invoice = payload || {}
      const nextSequence = invoice.sequence || getNextFallbackSequence(store)
      const invoiceId = Number(invoice.id || 0)
      const existing = invoiceId ? store.invoices.find((item) => Number(item.id) === invoiceId) : null
      const now = new Date().toISOString()

      const record = {
        ...existing,
        ...invoice,
        id: existing?.id || (store.invoices.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1),
        invoiceNumber: invoice.invoiceNumber || formatFallbackInvoiceNumber(nextSequence),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        items: (invoice.items || []).map((item, index) => ({
          ...item,
          serial: item.serial || index + 1,
        })),
      }

      if (existing) {
        store.invoices = store.invoices.map((item) => (Number(item.id) === invoiceId ? record : item))
      } else {
        store.invoices.unshift(record)
        store.sequence = nextSequence
      }

      writeFallbackStore(store)
      return record
    }

    case 'app:deleteInvoice': {
      store.invoices = store.invoices.filter((item) => Number(item.id) !== Number(payload))
      writeFallbackStore(store)
      return { deleted: true }
    }

    case 'app:getNextInvoiceNumber': {
      const nextSequence = getNextFallbackSequence(store)
      return {
        invoiceNumber: formatFallbackInvoiceNumber(nextSequence),
        nextSequence,
      }
    }

    case 'app:exportDatabase': {
      downloadJsonFile('delta-invoice-backup.json', store)
      return { success: true, path: 'delta-invoice-backup.json' }
    }

    case 'app:importDatabase':
      return { success: true }

    case 'app:backupJson': {
      window.localStorage.setItem(FALLBACK_BACKUP_KEY, JSON.stringify(store))
      downloadJsonFile('delta-invoice-backup.json', store)
      return { success: true, path: 'delta-invoice-backup.json' }
    }

    case 'app:restoreJson': {
      const backup = window.localStorage.getItem(FALLBACK_BACKUP_KEY)
      if (!backup) {
        return { success: false, error: 'No backup found in browser storage' }
      }

      const parsed = JSON.parse(backup)
      writeFallbackStore({
        settings: { ...defaultSettings, ...(parsed.settings || {}) },
        customers: Array.isArray(parsed.customers) ? parsed.customers : [],
        products: Array.isArray(parsed.products) ? parsed.products : [],
        invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
        sequence: Number(parsed.sequence || 0),
      })
      return { success: true }
    }

    default:
      return Promise.reject(new Error(`Unsupported fallback channel: ${channel}`))
  }
}

const invoke = (channel, payload) => {
  if (typeof window !== 'undefined' && window?.electron?.invoke) {
    return window.electron.invoke(channel, payload)
  }
  return fallbackInvoke(channel, payload)
}

export const api = {
  getSettings: () => invoke('app:getSettings'),
  saveSettings: (payload) => invoke('app:saveSettings', payload),
  getCustomers: () => invoke('app:getCustomers'),
  saveCustomer: (payload) => invoke('app:saveCustomer', payload),
  deleteCustomer: (id) => invoke('app:deleteCustomer', id),
  getProducts: () => invoke('app:getProducts'),
  saveProduct: (payload) => invoke('app:saveProduct', payload),
  deleteProduct: (id) => invoke('app:deleteProduct', id),
  getInvoices: (filter) => invoke('app:getInvoices', filter),
  getInvoiceById: (id) => invoke('app:getInvoiceById', id),
  saveInvoice: (payload) => invoke('app:saveInvoice', payload),
  deleteInvoice: (id) => invoke('app:deleteInvoice', id),
  getNextInvoiceNumber: () => invoke('app:getNextInvoiceNumber'),
  exportDatabase: () => invoke('app:exportDatabase'),
  importDatabase: () => invoke('app:importDatabase'),
  backupJson: () => invoke('app:backupJson'),
  restoreJson: () => invoke('app:restoreJson'),
}
