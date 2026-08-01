import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { formatCurrency, isInvoiceInMonth } from '../utils/format'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function Dashboard() {
  const [invoices, setInvoices] = useState([])
  const now = useMemo(() => new Date(), [])
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [monthlyRevenue, setMonthlyRevenue] = useState(0)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(selectedYear)
  const datePickerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false)
      }
    }
    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDatePickerOpen])

  const toggleDatePicker = () => {
    if (!isDatePickerOpen) {
      setPickerYear(selectedYear)
    }
    setIsDatePickerOpen(!isDatePickerOpen)
  }

  const handleMonthSelect = (monthIndex) => {
    setSelectedYear(pickerYear)
    setSelectedMonth(monthIndex + 1)
    setIsDatePickerOpen(false)
  }

  const loadInvoices = async () => {
    const response = await api.getInvoices()
    if (response && Array.isArray(response)) {
      setInvoices(response)
    }
  }

  const loadMonthlyRevenue = useCallback(async (year, month, currentInvoices = []) => {
    setLoadingMonthly(true)
    try {
      const response = await api.getMonthlyRevenue({ year, month })
      if (response && typeof response.totalRevenue === 'number' && !isNaN(response.totalRevenue)) {
        setMonthlyRevenue(response.totalRevenue)
        setLoadingMonthly(false)
        return
      }
    } catch (err) {
      console.warn('API getMonthlyRevenue failed or channel missing, using local invoices fallback:', err)
    }

    // Fallback calculation directly from loaded invoices list
    const sum = currentInvoices.reduce((acc, inv) => {
      if (isInvoiceInMonth(inv.invoiceDate, year, month)) {
        return acc + Number(inv.totalAmount || 0)
      }
      return acc
    }, 0)

    setMonthlyRevenue(sum)
    setLoadingMonthly(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [])

  useEffect(() => {
    loadMonthlyRevenue(selectedYear, selectedMonth, invoices)
  }, [selectedYear, selectedMonth, invoices, loadMonthlyRevenue])



  const stats = useMemo(() => {
    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
    const currentDate = new Date()
    const currentY = currentDate.getFullYear()
    const currentM = currentDate.getMonth() + 1

    const monthly = invoices.filter((invoice) => {
      return isInvoiceInMonth(invoice.invoiceDate, currentY, currentM)
    }).length

    return {
      totalInvoices: invoices.length,
      totalRevenue: revenue,
      monthlySales: monthly,
    }
  }, [invoices])



  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Invoices */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500 font-medium">Total Invoices</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{stats.totalInvoices}</p>
          <p className="mt-2 text-sm text-slate-500">All invoices stored locally.</p>
        </div>

        {/* Total Revenue */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500 font-medium">Total Revenue</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
          <p className="mt-2 text-sm text-slate-500">Revenue including GST.</p>
        </div>

        {/* Monthly Revenue Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500 font-medium">Monthly Revenue</p>
              <div className="relative flex items-center" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={toggleDatePicker}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 transition-all shadow-sm"
                  aria-label="Select Month and Year"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </button>
                
                {isDatePickerOpen && (
                  <div className="absolute top-full right-0 mt-2 p-3 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-64">
                    <div className="flex items-center justify-between mb-3">
                      <button 
                        onClick={() => setPickerYear(y => y - 1)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
                        aria-label="Previous year"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      <span className="font-semibold text-slate-700">{pickerYear}</span>
                      <button 
                        onClick={() => setPickerYear(y => y + 1)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
                        aria-label="Next year"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {MONTH_NAMES.map((m, idx) => {
                        const isSelected = pickerYear === selectedYear && idx + 1 === selectedMonth;
                        return (
                          <button
                            key={m}
                            onClick={() => handleMonthSelect(idx)}
                            className={`py-2 px-2 text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ${
                              isSelected
                                ? 'bg-slate-900 text-white font-medium shadow-sm hover:bg-slate-800'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {m.substring(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-4 text-4xl font-semibold text-slate-900">
              {loadingMonthly ? '...' : formatCurrency(monthlyRevenue)}
            </p>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Revenue for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </p>
        </div>

        {/* Invoices created this month */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500 font-medium">This month</p>
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
                    <p className="text-sm text-slate-500">{invoice.invoiceDate}</p>
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
