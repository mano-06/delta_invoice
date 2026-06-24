import { useContext, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { AppContext } from '../context/AppContext'
import useBackspaceNavigation from '../hooks/useBackspaceNavigation'
import useEnterNavigation from '../hooks/useEnterNavigation'
import { blurActiveElement } from '../utils/focusManagement'

function Settings() {
  const { settings, saveSettings } = useContext(AppContext)
  const { register, handleSubmit, reset, watch, setValue } = useForm()
  const logoInputRef = useRef(null)
  
  useEnterNavigation()
  useBackspaceNavigation()

  useEffect(() => {
    if (settings) {
      reset(settings)
    }
  }, [settings, reset])

  const companyLogo = watch('companyLogo')

      const handleLogoChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
          const dataUrl = ev.target.result
          setValue('companyLogo', dataUrl)
          // Persist to localStorage for fallback persistence
          try {
            window.localStorage.setItem('companyLogo', dataUrl)
          } catch (e) {
            console.error('Failed to store logo in localStorage', e)
          }
        }
        reader.readAsDataURL(file)
      }

  const onSubmit = async (data) => {
    // Ensure logo is included in payload
    const payload = { ...data, companyLogo };
    console.log('Submitting settings payload:', payload);
    const response = await saveSettings(payload);
    if (!response) {
      toast.error('Could not update settings');
      return;
    }
    toast.success('Settings saved');
    // Clear focus after save
    blurActiveElement();
  };

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
              <label className="block text-sm font-medium text-slate-700">Company Logo</label>
              <div className="mt-2 flex items-center gap-4">
                {companyLogo
                  ? <img src={companyLogo} alt="Company Logo" className="h-16 w-16 rounded-xl object-contain border border-slate-200" />
                  : <div className="h-16 w-16 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 text-center">No Logo</div>
                }
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {companyLogo ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {companyLogo && (
                    <button
                      type="button"
                      onClick={() => setValue('companyLogo', '')}
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
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
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">State Name</label>
                <input {...register('stateName')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                <input {...register('phoneNumber')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">HSN/SAC</label>
              <input {...register('hsnSac')} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none" />
              <p className="mt-2 text-xs text-slate-500">This HSN/SAC will be used as the default for new invoice rows.</p>
            </div>
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
              <input
                {...register('branchIfsc')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    handleSubmit(onSubmit)()
                  }
                }}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
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