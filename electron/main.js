const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { initializeDatabase, getDatabaseInstance } = require('./database')

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged
const devServerUrl = 'http://127.0.0.1:5173'

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1100,
    minHeight: 740,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('main window finished loading')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('main window failed to load', { errorCode, errorDescription })
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('render process gone', details)
  })

  if (isDev) {
    console.log('loading dev server URL', devServerUrl)
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  console.log('app ready, initializing database')
  initializeDatabase(app)
  console.log('database initialized, creating window')
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function sendError(error) {
  console.error(error)
  return { success: false, error: error.message || String(error) }
}

function safeParseJson(value) {
  try {
    return JSON.parse(value)
  } catch (error) {
    return value
  }
}

const db = {
  getSettings: () => {
    const database = getDatabaseInstance()
    return database.getSettings()
  },
  saveSettings: (payload) => {
    const database = getDatabaseInstance()
    return database.saveSettings(payload)
  },
  getCustomers: () => {
    const database = getDatabaseInstance()
    return database.getCustomers()
  },
  saveCustomer: (customer) => {
    const database = getDatabaseInstance()
    return database.saveCustomer(customer)
  },
  deleteCustomer: (id) => {
    const database = getDatabaseInstance()
    return database.deleteCustomer(id)
  },
  getProducts: () => {
    const database = getDatabaseInstance()
    return database.getProducts()
  },
  saveProduct: (product) => {
    const database = getDatabaseInstance()
    return database.saveProduct(product)
  },
  deleteProduct: (id) => {
    const database = getDatabaseInstance()
    return database.deleteProduct(id)
  },
  getInvoices: (filter) => {
    const database = getDatabaseInstance()
    return database.getInvoices(filter)
  },
  getInvoiceById: (id) => {
    const database = getDatabaseInstance()
    return database.getInvoiceById(id)
  },
  saveInvoice: (invoice) => {
    const database = getDatabaseInstance()
    return database.saveInvoice(invoice)
  },
  deleteInvoice: (id) => {
    const database = getDatabaseInstance()
    return database.deleteInvoice(id)
  },
  getNextInvoiceNumber: () => {
    const database = getDatabaseInstance()
    return database.getNextInvoiceNumber()
  },
  exportDatabase: async () => {
    const database = getDatabaseInstance()
    const result = await dialog.showSaveDialog({
      title: 'Export Database',
      defaultPath: path.join(app.getPath('documents'), 'delta-invoice-backup.db'),
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }
    database.exportDatabase(result.filePath)
    return { success: true, path: result.filePath }
  },
  importDatabase: async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Database',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePaths?.length) {
      return { success: false, canceled: true }
    }
    const database = getDatabaseInstance()
    database.importDatabase(result.filePaths[0])
    return { success: true }
  },
  backupJson: async () => {
    const database = getDatabaseInstance()
    const payload = database.exportJson()
    const result = await dialog.showSaveDialog({
      title: 'Export Backup JSON',
      defaultPath: path.join(app.getPath('documents'), 'delta-invoice-backup.json'),
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return { success: true, path: result.filePath }
  },
  restoreJson: async () => {
    const result = await dialog.showOpenDialog({
      title: 'Restore Backup JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePaths?.length) {
      return { success: false, canceled: true }
    }
    const database = getDatabaseInstance()
    const payload = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'))
    database.importJson(payload)
    return { success: true }
  },
}

Object.entries(db).forEach(([channel, handler]) => {
  ipcMain.handle(`app:${channel}`, async (_, payload) => {
    try {
      return await handler(payload)
    } catch (error) {
      return sendError(error)
    }
  })
})
