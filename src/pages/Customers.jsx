import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { api } from '../services/api'

const splitBillingAddress = (value = '') => {
  const lines = String(value || '').split(/\r?\n/).map((line) => line.trim())
  return {
    billingAddressLine1: lines[0] || '',
    billingAddressLine2: lines.slice(1).join(' ').trim(),
  }
}

const joinBillingAddress = (line1 = '', line2 = '') => [line1.trim(), line2.trim()].filter(Boolean).join('\n')

function Customers() {
  const [customers, setCustomers] = useState([])
  const [editing, setEditing] = useState(null)
  const { register, handleSubmit, reset, setValue } = useForm()

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    const response = await api.getCustomers()
    if (response.success === false) {
      toast.error('Unable to load customers')
      return
    }
    setCustomers(response)
  }

  const handleEdit = (customer) => {
    setEditing(customer)
    setValue('name', customer.name)
    const { billingAddressLine1, billingAddressLine2 } = splitBillingAddress(customer.billingAddress)
    setValue('billingAddressLine1', billingAddressLine1)
    setValue('billingAddressLine2', billingAddressLine2)
    setValue('gstin', customer.gstin)
    setValue('state', customer.state)
    setValue('phone', customer.phone)
    setValue('email', customer.email)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete customer?')) return
    const response = await api.deleteCustomer(id)
    if (response.success === false) {
      toast.error('Unable to delete customer')
      return
    }
    toast.success('Customer deleted')
    await loadCustomers()
    reset()
    setEditing(null)
  }

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      billingAddress: joinBillingAddress(data.billingAddressLine1, data.billingAddressLine2),
      id: editing?.id,
      createdAt: new Date().toISOString(),
    }
    const response = await api.saveCustomer(payload)
    if (response.success === false) {
      toast.error('Unable to save customer')
      return
    }
    toast.success('Customer saved')
    reset()
    setEditing(null)
    loadCustomers()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-900">Customer Management</h2>
        <p className="mt-1 text-sm text-slate-500">Add, edit or delete customers for your GST invoices.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Customer Form</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Customer Name</label>
              <input {...register('name')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Address Line 1</label>
                <input {...register('billingAddressLine1')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Address Line 2</label>
                <input {...register('billingAddressLine2')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">GST Number</label>
                <input {...register('gstin')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">State</label>
                <input {...register('state')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Phone</label>
                <input {...register('phone')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input {...register('email')} type="email" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Save Customer</button>
              {editing && (
                <button type="button" onClick={() => { reset(); setEditing(null) }} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Customer List</h3>
          <div className="mt-6 space-y-3">
            {customers.map((customer) => (
              <div key={customer.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{customer.name}</p>
                    <div className="text-sm text-slate-500">
                      <div>{splitBillingAddress(customer.billingAddress).billingAddressLine1}</div>
                      {splitBillingAddress(customer.billingAddress).billingAddressLine2 && (
                        <div>{splitBillingAddress(customer.billingAddress).billingAddressLine2}</div>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">GSTIN: {customer.gstin}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button onClick={() => handleEdit(customer)} className="rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">Edit</button>
                    <button onClick={() => handleDelete(customer.id)} className="rounded-full bg-red-50 px-4 py-2 text-red-600 hover:bg-red-100">Delete</button>
                  </div>
                </div>
              </div>
            ))}
            {customers.length === 0 && <p className="text-sm text-slate-500">No customers available yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Customers
