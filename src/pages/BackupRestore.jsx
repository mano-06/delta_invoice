import { useContext } from 'react'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { AppContext } from '../context/AppContext'

function BackupRestore() {
  const { loadSettings, loadCustomers, loadProducts } = useContext(AppContext)

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Unable to copy')
    }
  }

  const handleExportDb = async () => {
    const response = await api.exportDatabase()
    if (response.success === false) {
      toast.error('Export cancelled or failed')
      return
    }
    toast.success(`Database exported to ${response.path}`)
  }

  const handleImportDb = async () => {
    const response = await api.importDatabase()
    if (response.success === false) {
      toast.error('Import cancelled or failed')
      return
    }
    await Promise.all([loadSettings(), loadCustomers(), loadProducts()])
    toast.success('Database imported successfully')
  }

  const handleExportJson = async () => {
    const response = await api.backupJson()
    if (response.success === false) {
      toast.error('Export cancelled or failed')
      return
    }
    toast.success(`Backup JSON exported to ${response.path}`)
  }

  const handleRestoreJson = async () => {
    const response = await api.restoreJson()
    if (response.success === false) {
      toast.error('Restore cancelled or failed')
      return
    }
    await Promise.all([loadSettings(), loadCustomers(), loadProducts()])
    toast.success('Backup JSON restored successfully')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-900">Backup & Restore</h2>
        <p className="mt-1 text-sm text-slate-500">Export and restore your local SQLite database or JSON backup file.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Backup Database</h3>
          <p className="mt-2 text-sm text-slate-500">Export the full SQLite database file for offline archival.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handleExportDb} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Export DB</button>
            <button onClick={handleExportJson} className="rounded-full bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">Export JSON</button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Restore Data</h3>
          <p className="mt-2 text-sm text-slate-500">Restore from a previously exported database or JSON backup file.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handleImportDb} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Import DB</button>
            <button onClick={handleRestoreJson} className="rounded-full bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">Restore JSON</button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Safety Tips</h3>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Always keep a copy of your latest database export.</li>
          <li>Restore only from trusted backup files.</li>
          <li>Use JSON backups for portability and manual review.</li>
        </ul>
      </div>
    </div>
  )
}

export default BackupRestore
