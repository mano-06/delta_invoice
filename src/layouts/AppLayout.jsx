import { Link, useLocation } from 'react-router-dom'
import { useContext } from 'react'
import { AppContext } from '../context/AppContext'

const navItems = [
  { label: 'Dashboard', path: '/', shortcutIndex: 0 },
  { label: 'Create Invoice', path: '/create-invoice', shortcutIndex: 0 },
  { label: 'Invoice History', path: '/invoice-history', shortcutIndex: 0 },
  { label: 'Users / Customers', path: '/customers', shortcutIndex: 0 },
  { label: 'Products', path: '/products', shortcutIndex: 0 },
  { label: 'Settings', path: '/settings', shortcutIndex: 0 },
  { label: 'Backup & Restore', path: '/backup', shortcutIndex: 0 },
]

function AppLayout({ children }) {
  const location = useLocation()
  const { settings } = useContext(AppContext)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-80 border-r border-slate-200 bg-white shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-xl font-semibold tracking-tight">Delta Invoice</h1>
            <p className="mt-2 text-sm text-slate-500">GST Invoice Desktop App</p>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    {item.label.split('').map((char, index) =>
                      index === item.shortcutIndex ? (
                        <span key={index} className="underline decoration-slate-900">
                          {char}
                        </span>
                      ) : (
                        <span key={index}>{char}</span>
                      )
                    )}
                  </span>
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto p-6 text-xs text-slate-500">
            <p>Offline Windows app</p>
            <p className="mt-2">Data stored locally with SQLite</p>
          </div>
        </aside>
        <main className="flex-1 p-6">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Company</p>
              <h2 className="text-2xl font-semibold text-slate-900">{settings?.companyName || ''}</h2>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Current</p>
              <p className="text-lg font-semibold text-slate-900">{new Date().toLocaleDateString('en-GB').replace(/V/g,'-')}</p>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout
