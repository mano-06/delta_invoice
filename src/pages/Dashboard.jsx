import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { formatCurrency } from '../utils/format'

function Dashboard() {
  const [invoices, setInvoices] = useState([])

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    const response = await api.getInvoices()
    if (response.success === false) {
      return
    }
    setInvoices(response)
  }

  const stats = useMemo(() => {
    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
    const monthly = invoices.filter((invoice) => {
      const date = new Date(invoice.invoiceDate)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length
    return {
      totalInvoices: invoices.length,
      totalRevenue: revenue,
      monthlySales: monthly,
    }
  }, [invoices])

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Total Invoices</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{stats.totalInvoices}</p>
          <p className="mt-2 text-sm text-slate-500">All invoices stored locally.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Total Revenue</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
          <p className="mt-2 text-sm text-slate-500">Revenue including GST.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">This month</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{stats.monthlySales}</p>
          <p className="mt-2 text-sm text-slate-500">Invoices created this month.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recent Invoices</h3>
              <p className="mt-1 text-sm text-slate-500">Latest entries in the system.</p>
            </div>
            <Link
              to="/invoice-history"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
            >
              View history
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-slate-500">{invoice.buyerName || 'Unknown customer'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(invoice.totalAmount)}</p>
                  </div>
                </div>
              </div>
            ))}
            {invoices.length === 0 && <p className="text-sm text-slate-500">No invoices found.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
          <div className="mt-6 grid gap-4">
            <Link to="/create-invoice" className="rounded-3xl border border-slate-200 bg-slate-900 px-4 py-4 text-sm font-semibold text-white hover:bg-slate-800">
              Create New Invoice
            </Link>
            <Link to="/customers" className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">
              Manage Customers
            </Link>
            <Link to="/products" className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">
              Manage Products
            </Link>
            <Link to="/backup" className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:bg-slate-100">
              Backup / Restore Database
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
