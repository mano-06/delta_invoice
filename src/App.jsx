import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppLayout from './layouts/AppLayout'
import AppRoutes from './routes/AppRoutes'
import { AppProvider } from './context/AppContext'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
