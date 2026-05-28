import { useContext, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'

function Settings() {
  const { settings, saveSettings } = useContext(AppContext)
  const { register, handleSubmit, reset } = useForm()

  useEffect(() => {
    if (settings) {
      reset(settings)
    }
  }, [settings, reset])

  const onSubmit = async (data) => {
    const response = await saveSettings(data)
    if (!response) {
      toast.error('Could not update settings')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Company details, GST settings, and shared invoice defaults.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Company Details</h3>
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Company Name</label>
              <input {...register('companyName')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Address Line 1</label>
              <input {...register('address1')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Address Line 2</label>
              <input {...register('address2')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">City</label>
                <input {...register('city')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Pincode</label>
                <input {...register('pincode')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">GSTIN/UIN</label>
                <input {...register('gstin')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input type="email" {...register('email')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">State Name</label>
              <input {...register('stateName')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">HSN/SAC</label>
              <input {...register('hsnSac')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              <p className="mt-2 text-xs text-slate-500">This HSN/SAC will be used as the default for new invoice rows.</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Bank & Invoice Configuration</h3>
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Bank Name</label>
              <input {...register('bankName')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Account Number</label>
              <input {...register('accountNumber')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">IFS Code</label>
              <input {...register('branchIfsc')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
            </div>
          </div>
          <div className="mt-6">
            <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Save Settings</button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default Settings
