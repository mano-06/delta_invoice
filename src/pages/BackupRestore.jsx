import { useContext, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { AppContext } from '../context/AppContext'

function BackupRestore() {
  const { loadSettings, loadCustomers, loadProducts } = useContext(AppContext)
  const [focusedButtonIndex, setFocusedButtonIndex] = useState(null)
  const buttonRefs = useRef([])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle arrow keys and Enter when no element is focused in form fields
      const active = document.activeElement
      const isEditing = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA'
      
      if (isEditing) return

      const buttonContainer = document.querySelector('[data-backup-buttons]')
      if (!buttonContainer || !buttonContainer.contains(active)) {
        // Focus trap only works when in the button area
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
          // Only handle if we're focused on a button already
          if (!buttonRefs.current.includes(active)) return
        } else {
          return
        }
      }

      const isHorizontal = window.innerWidth >= 1024
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          moveFocusPrevious(isHorizontal)
          break
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          moveFocusNext(isHorizontal)
          break
        case 'Enter':
          e.preventDefault()
          if (focusedButtonIndex !== null && buttonRefs.current[focusedButtonIndex]) {
            buttonRefs.current[focusedButtonIndex].click()
          }
          break
        default:
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedButtonIndex])

  const moveFocusNext = (isHorizontal) => {
    setFocusedButtonIndex((prev) => {
      const next = (prev === null ? 0 : prev + 1) % buttonRefs.current.length
      buttonRefs.current[next]?.focus()
      return next
    })
  }

  const moveFocusPrevious = (isHorizontal) => {
    setFocusedButtonIndex((prev) => {
      const next = prev === null ? buttonRefs.current.length - 1 : (prev - 1 + buttonRefs.current.length) % buttonRefs.current.length
      buttonRefs.current[next]?.focus()
      return next
    })
  }

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

  const buttons = [
    { label: 'Export DB', onClick: handleExportDb },
    { label: 'Export JSON', onClick: handleExportJson },
    { label: 'Import DB', onClick: handleImportDb },
    { label: 'Restore JSON', onClick: handleRestoreJson },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-900">Backup & Restore</h2>
        <p className="mt-1 text-sm text-slate-500">Export and restore your local SQLite database or JSON backup file.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2" data-backup-buttons>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Backup Database</h3>
          <p className="mt-2 text-sm text-slate-500">Export the full SQLite database file for offline archival.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button 
              ref={(el) => { if (el) buttonRefs.current[0] = el }}
              onFocus={() => setFocusedButtonIndex(0)}
              onBlur={() => setFocusedButtonIndex(null)}
              onClick={handleExportDb} 
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
            >
              Export DB
            </button>
            <button 
              ref={(el) => { if (el) buttonRefs.current[1] = el }}
              onFocus={() => setFocusedButtonIndex(1)}
              onBlur={() => setFocusedButtonIndex(null)}
              onClick={handleExportJson} 
              className="rounded-full bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
            >
              Export JSON
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Restore Data</h3>
          <p className="mt-2 text-sm text-slate-500">Restore from a previously exported database or JSON backup file.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button 
              ref={(el) => { if (el) buttonRefs.current[2] = el }}
              onFocus={() => setFocusedButtonIndex(2)}
              onBlur={() => setFocusedButtonIndex(null)}
              onClick={handleImportDb} 
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
            >
              Import DB
            </button>
            <button 
              ref={(el) => { if (el) buttonRefs.current[3] = el }}
              onFocus={() => setFocusedButtonIndex(3)}
              onBlur={() => setFocusedButtonIndex(null)}
              onClick={handleRestoreJson} 
              className="rounded-full bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
            >
              Restore JSON
            </button>
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
