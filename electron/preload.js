const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  exitApp: () => ipcRenderer.send('exit-app'),
})
const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload)
const channels = [
  'app:getSettings',
  'app:saveSettings',
  'app:getCustomers',
  'app:saveCustomer',
  'app:deleteCustomer',
  'app:getProducts',
  'app:saveProduct',
  'app:deleteProduct',
  'app:getInvoices',
  'app:getInvoiceById',
  'app:saveInvoice',
  'app:deleteInvoice',
  'app:getNextInvoiceNumber',
  'app:getMonthlyRevenue',
  'app:exportDatabase',
  'app:importDatabase',
  'app:backupJson',
  'app:restoreJson',
  'app:exportPdf',
]

contextBridge.exposeInMainWorld('electron', {
  invoke: async (channel, payload) => {
    if (!channels.includes(channel)) {
      throw new Error(`Channel not allowed: ${channel}`)
    }
    return invoke(channel, payload)
  },
})
