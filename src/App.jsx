import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppLayout from './layouts/AppLayout'
import AppRoutes from './routes/AppRoutes'
import { AppProvider } from './context/AppContext'

function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
        <Toaster position="top-right" />
      </HashRouter>
    </AppProvider>
  )
}

export default App
