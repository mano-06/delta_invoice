const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')

ipcMain.on('exit-app', async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Yes', 'No'],
    defaultId: 1,
    title: 'Exit Application',
    message: 'Do you want to exit the application?',
  })

  if (result.response === 0) {
    app.quit()
  }
})

const {
  initializeDatabase,
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
  getMonthlyRevenue,
  exportDatabase: exportDatabaseFile,
  importDatabase: importDatabaseFile,
  exportJson,
  importJson,
} = require('./database')

process.on('uncaughtException', (error) => {
  console.error('uncaughtException:', error)
  app.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
  app.exit(1)
})

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged
const devServerUrl = 'http://127.0.0.1:5173'

function createMainWindow() {
  console.log('creating browser window')
  mainWindow = new BrowserWindow({
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
    const appPath = app.getAppPath()
    const distPath = path.join(appPath, 'dist', 'index.html')
    console.log('appPath:', appPath)
    console.log('loading dist file', distPath)
    mainWindow.loadFile(distPath)
  }
  console.log('window load request dispatched')
}

app.whenReady().then(() => {
  try {
    console.log('app ready, initializing database')
    initializeDatabase(app)
    console.log('database initialized, creating window')
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  } catch (error) {
    console.error('startup failed:', error)
    app.exit(1)
  }
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
  getSettings: () => getSettings(),
  saveSettings: (payload) => saveSettings(payload),
  getCustomers: () => getCustomers(),
  saveCustomer: (customer) => saveCustomer(customer),
  deleteCustomer: (id) => deleteCustomer(id),
  getProducts: () => getProducts(),
  saveProduct: (product) => saveProduct(product),
  deleteProduct: (id) => deleteProduct(id),
  getInvoices: (filter) => getInvoices(filter),
  getInvoiceById: (id) => getInvoiceById(id),
  saveInvoice: (invoice) => saveInvoice(invoice),
  deleteInvoice: (id) => deleteInvoice(id),
  getNextInvoiceNumber: () => getNextInvoiceNumber(),
  getMonthlyRevenue: (payload) => getMonthlyRevenue(payload),
  exportDatabase: async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Database',
      defaultPath: path.join(app.getPath('documents'), 'delta-invoice-backup.db'),
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }
    exportDatabaseFile(result.filePath)
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
    importDatabaseFile(result.filePaths[0])
    return { success: true }
  },
  backupJson: async () => {
    const payload = exportJson()
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
    const payload = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'))
    importJson(payload)
    return { success: true }
  },
  exportPdf: async ({ html, filename }) => {
    const result = await dialog.showSaveDialog({
      title: 'Save PDF',
      defaultPath: path.join(app.getPath('documents'), filename || 'invoice.pdf'),
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }
    
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } })
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    
    try {
      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'none' },
        preferCSSPageSize: true
      })
      fs.writeFileSync(result.filePath, pdfData)
    } finally {
      win.destroy()
    }
    return { success: true, path: result.filePath }
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
