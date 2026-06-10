import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppLayout from './layouts/AppLayout'
import AppRoutes from './routes/AppRoutes'
import { AppProvider } from './context/AppContext'
import { useEffect } from 'react';
import GlobalShortcuts from './components/GlobalShortcuts';


function App() {



  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === 'Escape' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        window.electronAPI.exitApp()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
  return (
    <AppProvider>
      <HashRouter>
        <GlobalShortcuts />
        <AppLayout>
          <AppRoutes />
        </AppLayout>
        <Toaster position="top-right" />
      </HashRouter>
    </AppProvider>
  )
}

export default App
