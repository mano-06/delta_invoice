import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import useBackspaceNavigation from '../hooks/useBackspaceNavigation';
import useEnterNavigation from '../hooks/useEnterNavigation';
import { blurActiveElement } from '../utils/focusManagement';
import { capitalizeDescription } from '../utils/format';

function Products() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const { register, handleSubmit, reset, setValue, setFocus, formState: { errors } } = useForm({ mode: 'onSubmit' });
  
  useEnterNavigation();
  useBackspaceNavigation();

  const onInvalid = (formErrors) => {
    const firstInvalid = Object.keys(formErrors)[0]
    if (firstInvalid) {
      setFocus(firstInvalid)
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const response = await api.getProducts();
    if (response.success === false) {
      toast.error('Unable to load products');
      return;
    }
    setProducts(response);
  };

  const handleEdit = (product) => {
    setEditing(product);
    setValue('name', product.name);
    setValue('rate', product.rate);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete product?')) return;
    const response = await api.deleteProduct(id);
    if (response.success === false) {
      toast.error('Unable to delete product');
      return;
    }
    toast.success('Product deleted');
    await loadProducts();
    reset();
    setEditing(null);
  };

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      name: capitalizeDescription(data.name),
      id: editing?.id,
      rate: Number(data.rate || 0),
      hsn: '',
      gstRate: 0,
      unit: '',
      createdAt: new Date().toISOString(),
    };
    const response = await api.saveProduct(payload);
    if (response.success === false) {
      toast.error('Unable to save product');
      return;
    }
    toast.success('Product saved');
    reset();
    setEditing(null);
    loadProducts();
    // Clear focus after save
    blurActiveElement();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-900">Product Management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add, edit or delete products for invoice item selection.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        {/* Product Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Product Form</h3>
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Product Name</label>
              <input
                {...register('name', { required: 'Product Name is required' })}
                aria-invalid={errors.name ? 'true' : 'false'}
                className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none ${errors.name ? 'border-red-500' : 'border-slate-300'}`}
              />
              {errors.name && (
                <p className="mt-2 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Rate</label>
              <input
                type="number"
                step="any"
                {...register('rate')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    handleSubmit(onSubmit, onInvalid)()
                  }
                }}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save Product
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setEditing(null);
                    blurActiveElement();
                  }}
                  className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Product List */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Product List</h3>
          <div className="mt-6 max-h-64 overflow-y-auto space-y-3">
            {products.map((product) => (
              <div key={product.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="text-sm text-slate-500">Rate: {product.rate}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      onClick={() => handleEdit(product)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="rounded-full bg-red-50 px-4 py-2 text-red-600 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-sm text-slate-500">No products added yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;
