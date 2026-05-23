import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'
import CreateInvoice from '../pages/CreateInvoice'
import InvoiceHistory from '../pages/InvoiceHistory'
import InvoicePreview from '../pages/InvoicePreview'
import Customers from '../pages/Customers'
import Products from '../pages/Products'
import Settings from '../pages/Settings'
import BackupRestore from '../pages/BackupRestore'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/create-invoice" element={<CreateInvoice />} />
      <Route path="/invoice-history" element={<InvoiceHistory />} />
      <Route path="/preview/:id" element={<InvoicePreview />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/products" element={<Products />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/backup" element={<BackupRestore />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AppRoutes
