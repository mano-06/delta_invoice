import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { formatCurrency } from '../utils/format'

function InvoiceHistory() {
  const [invoices, setInvoices] = useState([])
  const [search, setSearch] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    loadInvoices()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Enter') return
      if (document.activeElement === document.body || document.activeElement === document.documentElement) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadInvoices = async () => {
    const response = await api.getInvoices()
    if (response.success === false) {
      toast.error('Unable to load invoices')
      return
    }
    setInvoices(response)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) {
      return
    }
    const response = await api.deleteInvoice(id)
    if (response.success === false) {
      toast.error('Unable to delete invoice')
      return
    }
    toast.success('Invoice deleted')
    loadInvoices()
  }

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return invoices
    return invoices.filter((invoice) => {
      return (
        invoice.invoiceNumber?.toLowerCase().includes(term) ||
        invoice.buyerName?.toLowerCase().includes(term) ||
        invoice.buyerGstin?.toLowerCase().includes(term)
      )
    })
  }, [invoices, search])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Invoice History</h2>
            <p className="mt-1 text-sm text-slate-500">Search, review and manage invoices.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/create-invoice" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              New Invoice
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by invoice, buyer or GSTIN"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-card">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3">Invoice No.</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-4 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                <td className="px-4 py-4 text-slate-700">{invoice.buyerName}</td>
                <td className="px-4 py-4 text-slate-700">{new Date(invoice.invoiceDate).toLocaleDateString('en-GB').replace(/V/g,'-')}</td>
                <td className="px-4 py-4 text-slate-700">{formatCurrency(invoice.totalAmount)}</td>
                <td className="px-4 py-4 space-x-2">
                  <Link
                    to={`/preview/${invoice.id}`}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default InvoiceHistory
