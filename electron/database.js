const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

let db
let currentDbPath

const defaultSettings = {
  companyName: 'Delta Invoice',
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

function getDatabasePath(userDataPath) {
  const dbDir = path.join(userDataPath, 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  return path.join(dbDir, 'delta-invoice.db')
}

function getDatabaseInstance() {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

function initializeDatabase(app) {
  const dbPath = getDatabasePath(app.getPath('userData'))
  currentDbPath = dbPath
  console.log('opening sqlite database at', dbPath)
  db = new Database(dbPath)
  console.log('database connection created')
  console.log('creating tables')
  createTables()
  console.log('tables created')
  console.log('ensuring defaults')
  ensureDefaults()
  console.log('database initialized successfully')
}

function ensureColumn(tableName, columnName, columnType) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  const exists = columns.some((column) => column.name === columnName)
  if (!exists) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`).run()
  }
}

function createTables() {
  console.log('creating settings table')
  db.prepare(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    companyName TEXT,
    address1 TEXT,
    address2 TEXT,
    city TEXT,
    pincode TEXT,
    gstin TEXT,
    stateName TEXT,
    stateCode TEXT,
    email TEXT,
    phone TEXT,
    bankName TEXT,
    accountNumber TEXT,
    branchIfsc TEXT,
    invoicePrefix TEXT,
    invoiceStart INTEGER,
    invoiceFormat TEXT
  )`).run()
  ensureColumn('settings', 'hsnSac', 'TEXT')
  console.log('settings table ready')

  console.log('creating customers table')
  db.prepare(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    billingAddress TEXT,
    gstin TEXT,
    state TEXT,
    stateCode TEXT,
    phone TEXT,
    email TEXT,
    createdAt TEXT
  )`).run()
  console.log('customers table ready')

  console.log('creating products table')
  db.prepare(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    hsn TEXT,
    rate REAL,
    gstRate REAL,
    unit TEXT,
    createdAt TEXT
  )`).run()
  console.log('products table ready')

  console.log('creating invoice_sequence table')
  db.prepare(`CREATE TABLE IF NOT EXISTS invoice_sequence (
    id INTEGER PRIMARY KEY,
    lastSequence INTEGER
  )`).run()
  console.log('invoice_sequence table ready')

  console.log('creating invoices table')
  db.prepare(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceNumber TEXT,
    invoiceDate TEXT,
    buyerName TEXT,
    buyerAddress TEXT,
    buyerGstin TEXT,
    buyerState TEXT,
    buyerStateCode TEXT,
    deliveryNote TEXT,
    paymentTerms TEXT,
    referenceNo TEXT,
    referenceDate TEXT,
    orderNo TEXT,
    orderDate TEXT,
    dispatchDocNo TEXT,
    dispatchDate TEXT,
    transporter TEXT,
    destination TEXT,
    termsOfDelivery TEXT,
    totalQuantity REAL,
    taxableValue REAL,
    cgstAmount REAL,
    sgstAmount REAL,
    roundOff REAL,
    totalAmount REAL,
    amountWords TEXT,
    taxAmountWords TEXT,
    bankName TEXT,
    accountNumber TEXT,
    branchIfsc TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )`).run()
  console.log('invoices table ready')

  console.log('creating invoice_items table')
  db.prepare(`CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceId INTEGER,
    serial INTEGER,
    description TEXT,
    hsn TEXT,
    quantity REAL,
    rate REAL,
    unit TEXT,
    amount REAL,
    taxRate REAL,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
  )`).run()
  console.log('invoice_items table ready')
}

function ensureDefaults() {
  const row = db.prepare('SELECT * FROM settings LIMIT 1').get()

  if (!row) {
    const stmt = db.prepare(`INSERT INTO settings (
      companyName, address1, address2, city, pincode, gstin, stateName, email, phone, bankName, accountNumber, branchIfsc, hsnSac
    ) VALUES (@companyName, @address1, @address2, @city, @pincode, @gstin, @stateName, @email, @phone, @bankName, @accountNumber, @branchIfsc, @hsnSac)`)
    stmt.run(defaultSettings)
  } else {
    const updates = {}

    if (!row.companyName) updates.companyName = defaultSettings.companyName
    if (!row.hsnSac) updates.hsnSac = defaultSettings.hsnSac

    if (Object.keys(updates).length > 0) {
      const stmt = db.prepare(`UPDATE settings SET
        companyName = @companyName,
        hsnSac = @hsnSac
        WHERE id = @id`)
      stmt.run({
        companyName: updates.companyName || row.companyName,
        hsnSac: updates.hsnSac || row.hsnSac,
        id: row.id,
      })
    }
  }

  const sequence = db.prepare('SELECT id FROM invoice_sequence LIMIT 1').get()
  if (!sequence) {
    db.prepare('INSERT INTO invoice_sequence (id, lastSequence) VALUES (1, @sequence)').run({ sequence: 0 })
  }
}

function getSettings() {
  return db.prepare('SELECT * FROM settings LIMIT 1').get()
}

function saveSettings(payload = {}) {
  const existing = getSettings()
  const normalized = {
    companyName: payload.companyName || '',
    address1: payload.address1 || '',
    address2: payload.address2 || '',
    city: payload.city || '',
    pincode: payload.pincode || '',
    gstin: payload.gstin || '',
    stateName: payload.stateName || '',
    email: payload.email || '',
    phone: payload.phone || '',
    bankName: payload.bankName || '',
    accountNumber: payload.accountNumber || '',
    branchIfsc: payload.branchIfsc || '',
    hsnSac: payload.hsnSac || '',
  }

  if (existing) {
    const stmt = db.prepare(`UPDATE settings SET
      companyName=@companyName,
      address1=@address1,
      address2=@address2,
      city=@city,
      pincode=@pincode,
      gstin=@gstin,
      stateName=@stateName,
      email=@email,
      phone=@phone,
      bankName=@bankName,
      accountNumber=@accountNumber,
      branchIfsc=@branchIfsc,
      hsnSac=@hsnSac,
      stateCode=''
      WHERE id=@id`)
    return stmt.run({ ...normalized, id: existing.id })
  }

  const stmt = db.prepare(`INSERT INTO settings (
    companyName, address1, address2, city, pincode, gstin, stateName, email, phone, bankName, accountNumber, branchIfsc, hsnSac
  ) VALUES (@companyName, @address1, @address2, @city, @pincode, @gstin, @stateName, @email, @phone, @bankName, @accountNumber, @branchIfsc, @hsnSac)`)
  return stmt.run(normalized)
}

function getCustomers() {
  return db.prepare('SELECT * FROM customers ORDER BY id DESC').all()
}

function saveCustomer(payload = {}) {
  const normalized = {
    ...payload,
    stateCode: payload.stateCode || '',
  }

  if (normalized.id) {
    const stmt = db.prepare(`UPDATE customers SET
      name=@name,
      billingAddress=@billingAddress,
      gstin=@gstin,
      state=@state,
      stateCode=@stateCode,
      phone=@phone,
      email=@email
      WHERE id=@id`
    )
    return stmt.run(normalized)
  }

  const stmt = db.prepare(`INSERT INTO customers
    (name, billingAddress, gstin, state, stateCode, phone, email, createdAt)
    VALUES (@name, @billingAddress, @gstin, @state, @stateCode, @phone, @email, @createdAt)`)
  return stmt.run({ ...normalized, createdAt: new Date().toISOString() })
}

function deleteCustomer(id) {
  return db.prepare('DELETE FROM customers WHERE id = ?').run(id)
}

function getProducts() {
  return db.prepare('SELECT * FROM products ORDER BY id DESC').all()
}

function saveProduct(payload = {}) {
  const normalized = {
    ...payload,
    hsn: '',
    gstRate: 0,
    unit: '',
  }

  if (normalized.id) {
    const stmt = db.prepare(`UPDATE products SET
      name=@name,
      hsn=@hsn,
      rate=@rate,
      gstRate=@gstRate,
      unit=@unit
      WHERE id=@id`
    )
    return stmt.run(normalized)
  }

  const stmt = db.prepare(`INSERT INTO products
    (name, hsn, rate, gstRate, unit, createdAt)
    VALUES (@name, @hsn, @rate, @gstRate, @unit, @createdAt)`)
  return stmt.run({ ...normalized, createdAt: new Date().toISOString() })
}

function deleteProduct(id) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id)
}

function getInvoices(filter = {}) {
  let query = 'SELECT * FROM invoices ORDER BY id DESC'
  if (filter?.customerName) {
    query = 'SELECT * FROM invoices WHERE buyerName LIKE ? ORDER BY id DESC'
    return db.prepare(query).all(`%${filter.customerName}%`)
  }
  return db.prepare(query).all()
}

function getInvoiceById(id) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)
  if (!invoice) return null
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ? ORDER BY serial ASC').all(id)
  return { ...invoice, items }
}

function getNextInvoiceNumber() {
  const sequence = db.prepare('SELECT lastSequence FROM invoice_sequence WHERE id = 1').get()
  const nextSequence = (sequence?.lastSequence || 0) + 1
  return {
    nextSequence,
    invoiceNumber: `DD/${nextSequence}`,
  }
}

function saveInvoice(payload) {
  const now = new Date().toISOString()
  let invoiceId
  const existing = payload.id ? getInvoiceById(payload.id) : null
  const nextNumber = getNextInvoiceNumber()

  const record = {
    invoiceNumber: payload.invoiceNumber || nextNumber.invoiceNumber,
    invoiceDate: payload.invoiceDate,
    buyerName: payload.buyerName,
    buyerAddress: payload.buyerAddress,
    buyerGstin: payload.buyerGstin,
    buyerState: payload.buyerState,
    buyerStateCode: '',
    deliveryNote: payload.deliveryNote,
    paymentTerms: payload.paymentTerms,
    referenceNo: payload.referenceNo,
    referenceDate: payload.referenceDate,
    orderNo: payload.orderNo,
    orderDate: payload.orderDate,
    dispatchDocNo: payload.dispatchDocNo,
    dispatchDate: payload.dispatchDate,
    transporter: payload.transporter,
    destination: payload.destination,
    termsOfDelivery: payload.termsOfDelivery,
    totalQuantity: payload.totalQuantity,
    taxableValue: payload.taxableValue,
    cgstAmount: payload.cgstAmount,
    sgstAmount: payload.sgstAmount,
    roundOff: payload.roundOff,
    totalAmount: payload.totalAmount,
    amountWords: payload.amountWords,
    taxAmountWords: payload.taxAmountWords,
    bankName: payload.bankName,
    accountNumber: payload.accountNumber,
    branchIfsc: payload.branchIfsc,
    updatedAt: now,
  }

  if (existing) {
    const stmt = db.prepare(`UPDATE invoices SET
      invoiceNumber=@invoiceNumber,
      invoiceDate=@invoiceDate,
      buyerName=@buyerName,
      buyerAddress=@buyerAddress,
      buyerGstin=@buyerGstin,
      buyerState=@buyerState,
      buyerStateCode=@buyerStateCode,
      deliveryNote=@deliveryNote,
      paymentTerms=@paymentTerms,
      referenceNo=@referenceNo,
      referenceDate=@referenceDate,
      orderNo=@orderNo,
      orderDate=@orderDate,
      dispatchDocNo=@dispatchDocNo,
      dispatchDate=@dispatchDate,
      transporter=@transporter,
      destination=@destination,
      termsOfDelivery=@termsOfDelivery,
      totalQuantity=@totalQuantity,
      taxableValue=@taxableValue,
      cgstAmount=@cgstAmount,
      sgstAmount=@sgstAmount,
      roundOff=@roundOff,
      totalAmount=@totalAmount,
      amountWords=@amountWords,
      taxAmountWords=@taxAmountWords,
      bankName=@bankName,
      accountNumber=@accountNumber,
      branchIfsc=@branchIfsc,
      updatedAt=@updatedAt
      WHERE id=@id`)
    stmt.run({ ...record, id: payload.id })
    invoiceId = payload.id
    db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(invoiceId)
  } else {
    const stmt = db.prepare(`INSERT INTO invoices (
      invoiceNumber, invoiceDate, buyerName, buyerAddress, buyerGstin, buyerState, buyerStateCode,
      deliveryNote, paymentTerms, referenceNo, referenceDate, orderNo, orderDate,
      dispatchDocNo, dispatchDate, transporter, destination, termsOfDelivery,
      totalQuantity, taxableValue, cgstAmount, sgstAmount, roundOff, totalAmount,
      amountWords, taxAmountWords, bankName, accountNumber, branchIfsc, createdAt, updatedAt
    ) VALUES (
      @invoiceNumber, @invoiceDate, @buyerName, @buyerAddress, @buyerGstin, @buyerState, @buyerStateCode,
      @deliveryNote, @paymentTerms, @referenceNo, @referenceDate, @orderNo, @orderDate,
      @dispatchDocNo, @dispatchDate, @transporter, @destination, @termsOfDelivery,
      @totalQuantity, @taxableValue, @cgstAmount, @sgstAmount, @roundOff, @totalAmount,
      @amountWords, @taxAmountWords, @bankName, @accountNumber, @branchIfsc, @createdAt, @updatedAt
    )`)
    const result = stmt.run({ ...record, createdAt: now })
    invoiceId = result.lastInsertRowid
    db.prepare('UPDATE invoice_sequence SET lastSequence = ? WHERE id = 1').run(payload.sequence || nextNumber.nextSequence)
  }

  const insertItem = db.prepare(`INSERT INTO invoice_items
    (invoiceId, serial, description, hsn, quantity, rate, unit, amount, taxRate)
    VALUES (@invoiceId, @serial, @description, @hsn, @quantity, @rate, @unit, @amount, @taxRate)`)
  const insertMany = db.transaction((items) => {
    items.forEach((item) => insertItem.run({
      ...item,
      invoiceId,
      taxRate: item.taxRate || 5,
    }))
  })
  insertMany(payload.items || [])

  return getInvoiceById(invoiceId)
}

function deleteInvoice(id) {
  db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(id)
  return db.prepare('DELETE FROM invoices WHERE id = ?').run(id)
}

function exportDatabase(destinationPath) {
  if (fs.existsSync(currentDbPath)) {
    fs.copyFileSync(currentDbPath, destinationPath)
  }
}

function importDatabase(sourcePath) {
  if (fs.existsSync(sourcePath)) {
    db.close()
    fs.copyFileSync(sourcePath, currentDbPath)
    db = new Database(currentDbPath)
  }
}

function exportJson() {
  const settings = getSettings()
  const customers = getCustomers()
  const products = getProducts()
  const invoices = getInvoices().map((invoice) => {
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ? ORDER BY serial ASC').all(invoice.id)
    return { ...invoice, items }
  })
  return { settings, customers, products, invoices }
}

function importJson(payload) {
  const transaction = db.transaction((data) => {
    if (data.settings) {
      saveSettings(data.settings)
    }
    if (data.customers) {
      db.prepare('DELETE FROM customers').run()
      const stmt = db.prepare(`INSERT INTO customers (id, name, billingAddress, gstin, state, stateCode, phone, email, createdAt) VALUES (@id, @name, @billingAddress, @gstin, @state, @stateCode, @phone, @email, @createdAt)`)
      data.customers.forEach((item) => stmt.run({ ...item, createdAt: item.createdAt || new Date().toISOString() }))
    }
    if (data.products) {
      db.prepare('DELETE FROM products').run()
      const stmt = db.prepare(`INSERT INTO products (id, name, hsn, rate, gstRate, unit, createdAt) VALUES (@id, @name, @hsn, @rate, @gstRate, @unit, @createdAt)`)
      data.products.forEach((item) => stmt.run({ ...item, createdAt: item.createdAt || new Date().toISOString() }))
    }
    if (data.invoices) {
      db.prepare('DELETE FROM invoice_items').run()
      db.prepare('DELETE FROM invoices').run()
      const invoiceStmt = db.prepare(`INSERT INTO invoices (
        id, invoiceNumber, invoiceDate, buyerName, buyerAddress, buyerGstin, buyerState, buyerStateCode,
        deliveryNote, paymentTerms, referenceNo, referenceDate, orderNo, orderDate,
        dispatchDocNo, dispatchDate, transporter, destination, termsOfDelivery,
        totalQuantity, taxableValue, cgstAmount, sgstAmount, roundOff, totalAmount,
        amountWords, taxAmountWords, bankName, accountNumber, branchIfsc, createdAt, updatedAt
      ) VALUES (
        @id, @invoiceNumber, @invoiceDate, @buyerName, @buyerAddress, @buyerGstin, @buyerState, @buyerStateCode,
        @deliveryNote, @paymentTerms, @referenceNo, @referenceDate, @orderNo, @orderDate,
        @dispatchDocNo, @dispatchDate, @transporter, @destination, @termsOfDelivery,
        @totalQuantity, @taxableValue, @cgstAmount, @sgstAmount, @roundOff, @totalAmount,
        @amountWords, @taxAmountWords, @bankName, @accountNumber, @branchIfsc, @createdAt, @updatedAt
      )`)
      const itemStmt = db.prepare(`INSERT INTO invoice_items (invoiceId, serial, description, hsn, quantity, rate, unit, amount, taxRate) VALUES (@invoiceId, @serial, @description, @hsn, @quantity, @rate, @unit, @amount, @taxRate)`)
      data.invoices.forEach((invoice) => {
        invoiceStmt.run({ ...invoice })
        invoice.items?.forEach((item) => itemStmt.run({ ...item, invoiceId: invoice.id }))
      })
    }
  })
  transaction(payload)
}

module.exports = {
  initializeDatabase,
  getDatabaseInstance,
  getSettings,
  saveSettings,
  getCustomers,
  saveCustomer,
  deleteCustomer,
  getProducts,
  saveProduct,
  deleteProduct,
  getInvoices,
  getInvoiceById,
  saveInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
  exportDatabase,
  importDatabase,
  exportJson,
  importJson,
}
