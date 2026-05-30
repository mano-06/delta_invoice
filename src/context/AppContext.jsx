import { createContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../services/api'

export const AppContext = createContext()

const unwrapResponse = (response) => {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data
  }
  return response
}

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    loadSettings()
    loadCustomers()
    loadProducts()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await api.getSettings()
      if (response?.success === false) { throw new Error(response.error) }
      const fetched = unwrapResponse(response)
      // Merge logo from localStorage if not present
      const storedLogo = window.localStorage.getItem('companyLogo')
      if (storedLogo && !fetched.companyLogo) {
        fetched.companyLogo = storedLogo
      }
      setSettings(fetched)
    } catch (error) {
      toast.error('Unable to load settings')
    }
  }

  const saveSettings = async (payload) => {
    try {
      const response = await api.saveSettings(payload)
      if (response?.success === false) { throw new Error(response.error) }
      await loadSettings()
      toast.success('Settings saved')
      return unwrapResponse(response)
    } catch (error) {
      toast.error('Unable to save settings')
      return null
    }
  }

  const loadCustomers = async () => {
    try {
      const response = await api.getCustomers()
      if (response?.success === false) { throw new Error(response.error) }
      setCustomers(Array.isArray(unwrapResponse(response)) ? unwrapResponse(response) : [])
    } catch (error) {
      toast.error('Unable to load customers')
    }
  }

  const loadProducts = async () => {
    try {
      const response = await api.getProducts()
      if (response?.success === false) { throw new Error(response.error) }
      setProducts(Array.isArray(unwrapResponse(response)) ? unwrapResponse(response) : [])
    } catch (error) {
      toast.error('Unable to load products')
    }
  }

  return (
    <AppContext.Provider
      value={{
        settings,
        saveSettings,
        loadSettings,
        customers,
        loadCustomers,
        products,
        loadProducts,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
