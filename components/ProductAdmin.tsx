'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/components/LanguageProvider';
import type { Product, Category, Table } from '@/types';

export default function ProductAdmin() {
  const { t, locale } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'tables'>('products');
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    category: '',
    price: 0,
    barcode: '',
    stock: 0,
    image_url: '',
    tax_rate: undefined as number | undefined,
  });
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    name: '',
    tax_rate: 0.1,
  });
  const [tableForm, setTableForm] = useState({
    id: '',
    name: '',
    status: 'available' as 'available' | 'occupied',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // locale이 변경될 때 데이터 다시 불러오기
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchTables();
  }, [locale]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchTables();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      setMessage(t('common.failedLoadProducts'));
      return;
    }
    setProducts(data || []);
  }

  async function fetchCategories() {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.from('categories').select('*').order('name');
    setLoading(false);
    if (error) {
      setMessage(t('common.failedLoadCategories'));
      return;
    }
    setCategories(data || []);
  }

  async function fetchTables() {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.from('tables').select('*').order('id');
    setLoading(false);
    if (error) {
      setMessage(t('common.failedLoadTables'));
      return;
    }
    setTables(data || []);
    if (!data || data.length === 0) {
      setMessage(t('common.noTables'));
    }
  }

  function resetProductForm() {
    setProductForm({
      id: '',
      name: '',
      category: '',
      price: 0,
      barcode: '',
      stock: 0,
      image_url: '',
      tax_rate: undefined,
    });
    setImageFile(null);
    setMessage(null);
  }

  function resetCategoryForm() {
    setCategoryForm({ id: '', name: '', tax_rate: 0 });
    setMessage(null);
  }

  function resetTableForm() {
    setTableForm({ id: '', name: '', status: 'available' });
    setMessage(null);
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setMessage(t('common.selectedImage', { name: file.name }));
  }

  async function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!productForm.name || !productForm.category || productForm.price <= 0 || productForm.stock < 0) {
      setMessage(t('common.fillRequired'));
      return;
    }

    setLoading(true);

    let imageUrl = productForm.image_url;
    if (imageFile) {
      const supabase = getSupabase();

      const fileExtension = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;

      const { data, error: uploadError } = await supabase
        .storage
        .from('products')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        setLoading(false);
        setMessage(t('common.imageUploadError') + ': ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      imageUrl = urlData.publicUrl;
    }

    const supabase = getSupabase();
    const payload = {
      name: productForm.name,
      category: productForm.category,
      price: productForm.price,
      barcode: productForm.barcode || null,
      stock: productForm.stock,
      image_url: imageUrl || null,
      tax_rate: productForm.tax_rate || null,
    };

    if (productForm.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', productForm.id);
      setLoading(false);
      if (error) {
        console.error('Update error:', error);
        setMessage(t('common.productUpdateError', { msg: error.message }));
        return;
      }
      setMessage(t('common.productUpdated'));
    } else {
      const { error } = await supabase.from('products').insert(payload);
      setLoading(false);
      if (error) {
        console.error('Insert error:', error);
        setMessage(t('common.productAddError', { msg: error.message }));
        return;
      }
      setMessage(t('common.productAdded'));
    }

    resetProductForm();
    setIsModalOpen(false);
    fetchProducts();
  }

  async function handleCategorySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!categoryForm.name) {
      setMessage(t('common.enterCategoryName'));
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    const payload = {
      name: categoryForm.name,
      tax_rate: categoryForm.tax_rate || 0.1,
    };

    if (categoryForm.id) {
      const { error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', categoryForm.id);
      setLoading(false);
      if (error) {
        setMessage(t('common.categoryUpdateError'));
        return;
      }
      setMessage(t('common.categoryUpdated'));

      const { error: productUpdateError } = await supabase
        .from('products')
        .update({ tax_rate: categoryForm.tax_rate || 0.1 })
        .eq('category', categoryForm.name);

      if (productUpdateError) {
        console.error('Error updating products tax_rate:', productUpdateError);
      } else {
        console.log(`Updated all products in category "${categoryForm.name}" to tax_rate ${categoryForm.tax_rate || 0.1}`);
      }
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      setLoading(false);
      if (error) {
        setMessage(t('common.categoryAddError'));
        return;
      }
      setMessage(t('common.categoryAdded'));
    }

    resetCategoryForm();
    fetchCategories();
    fetchProducts();
  }

   async function handleTableSubmit(event: React.FormEvent<HTMLFormElement>) {
     event.preventDefault();
     setMessage(null);

     if (!tableForm.name) {
       setMessage(t('common.enterTableName'));
       return;
     }

     setLoading(true);
     const supabase = getSupabase();

     if (tableForm.id) {
       // Update existing table
       const payload = {
         id: tableForm.id,
         name: tableForm.name,
         status: tableForm.status,
       };
       const { error } = await supabase.from('tables').update(payload).eq('id', tableForm.id);
       setLoading(false);
       if (error) {
         setMessage(t('common.tableUpdateError'));
         return;
       }
       setMessage(t('common.tableUpdated'));
     } else {
       // Insert new table (id will be generated by DB)
       const payload = {
         name: tableForm.name,
         status: tableForm.status,
       };
       const { error } = await supabase.from('tables').insert(payload);
       setLoading(false);
       if (error) {
         setMessage(t('common.tableAddError'));
         return;
       }
       setMessage(t('common.tableAdded'));
     }

     resetTableForm();
     fetchTables();
   }

  async function handleProductDelete(id: string) {
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('products').delete().eq('id', id);
    setLoading(false);
    if (error) {
      setMessage(t('common.productDeleteError'));
      return;
    }
    setMessage(t('common.productDeleted'));
    fetchProducts();
  }

  async function handleCategoryDelete(id: string) {
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('categories').delete().eq('id', id);
    setLoading(false);
    if (error) {
      setMessage(t('common.categoryDeleteError'));
      return;
    }
    setMessage(t('common.categoryDeleted'));
    fetchCategories();
  }

  async function handleTableDelete(id: string) {
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('tables').delete().eq('id', id);
    setLoading(false);
    if (error) {
      setMessage(t('common.tableDeleteError'));
      return;
    }
    setMessage(t('common.tableDeleted'));
    fetchTables();
  }

  function handleProductEdit(product: Product) {
    setProductForm({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      barcode: product.barcode ?? '',
      stock: product.stock,
      image_url: product.image_url ?? '',
      tax_rate: product.tax_rate,
    });
    setImageFile(null);
    setMessage(t('common.editModeActive'));
    setIsModalOpen(true);
  }

  function handleCategoryEdit(category: Category) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      tax_rate: category.tax_rate ?? 0,
    });
    setMessage(t('common.editModeActive'));
  }

  function handleTableEdit(table: Table) {
    setTableForm({
      id: table.id,
      name: table.name,
      status: table.status,
    });
    setMessage(t('common.editModeActive'));
  }

  const stockSummary = useMemo(() => {
    return products.reduce((acc, product) => acc + product.stock, 0);
  }, [products]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((cat) => map.set(cat.name, cat));
    return map;
  }, [categories]);

  const getDisplayTaxRate = (product: Product) => {
    if (product.tax_rate !== undefined && product.tax_rate !== null) {
      return `${(product.tax_rate * 100).toFixed(1)}%`;
    }
    const category = categoryMap.get(product.category);
    if (category && category.tax_rate !== undefined && category.tax_rate !== null) {
      return `${(category.tax_rate * 100).toFixed(1)}%`;
    }
    return t('common.defaultTax');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'products' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveTab('products')}
        >
          {t('common.productManagement')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'categories' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveTab('categories')}
        >
          {t('common.categoryManagement')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'tables' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveTab('tables')}
        >
          {t('common.tableManagement')}
        </button>
      </div>

      {activeTab === 'products' ? (
        <section className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{t('common.productManagement')}</h2>
              <p className="mt-2 text-slate-600">{t('common.manage_products_desc')}</p>
            </div>
            <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {t('common.totalStock', { count: stockSummary })}
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => {
                resetProductForm();
                setIsModalOpen(true);
              }}
              className="button-primary"
            >
              {t('common.addProduct')}
            </button>
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-4">
                  {productForm.id ? t('common.editProduct') : t('common.addProduct')}
                </h3>
                <form onSubmit={handleProductSubmit} className="grid gap-4">
                  <label className="field-label">
                    {t('common.productName')}
                    <input
                      className="input-base mt-2"
                      value={productForm.name}
                      onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                      required
                    />
                  </label>
                  <label className="field-label">
                    {t('common.category')}
                    <select
                      className="input-base mt-2"
                      value={productForm.category}
                      onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                      required
                    >
                      <option value="">{t('common.selectCategory')}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    {t('common.price')}
                    <input
                      className="input-base mt-2"
                      type="number"
                      min="0"
                      step="0.01"
                      value={productForm.price || ''}
                      placeholder="0"
                      onChange={(event) => setProductForm({ ...productForm, price: Number(event.target.value) || 0 })}
                      required
                    />
                  </label>
                  <label className="field-label">
                    {t('common.stockQty')}
                    <input
                      className="input-base mt-2"
                      type="number"
                      min="0"
                      value={productForm.stock || ''}
                      placeholder="0"
                      onChange={(event) => setProductForm({ ...productForm, stock: Number(event.target.value) || 0 })}
                      required
                    />
                  </label>
                  <label className="field-label">
                    {t('common.barcodeOptional')}
                    <input
                      className="input-base mt-2"
                      value={productForm.barcode}
                      onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })}
                    />
                  </label>
                  <label className="field-label">
                    {t('common.taxRateOptional')}
                    <input
                      className="input-base mt-2"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={productForm.tax_rate !== undefined ? productForm.tax_rate * 100 : ''}
                      placeholder={t('common.useCategoryDefault')}
                      onChange={(event) => setProductForm({
                        ...productForm,
                        tax_rate: event.target.value === '' ? undefined : Number(event.target.value) / 100,
                      })}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {productForm.tax_rate !== undefined
                        ? t('common.individualSetting', { rate: (productForm.tax_rate * 100).toFixed(1) })
                        : t('common.useCategoryDefaultTax')}
                    </p>
                  </label>
                  <label className="field-label">
                    {t('common.imageOptional')}
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-slate-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-slate-100 file:text-slate-700
                          hover:file:bg-slate-200"
                      />
                      {imageFile && <p className="mt-2 text-sm text-slate-600">{t('common.selectedImage', { name: imageFile.name })}</p>}
                    </div>
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button className="button-primary" type="submit" disabled={loading}>
                      {productForm.id ? t('common.edit') : t('common.add')}
                    </button>
                    <button type="button" className="button-secondary" onClick={() => setIsModalOpen(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                  {message ? <p className="text-sm text-slate-700">{message}</p> : null}
                </form>
              </div>
            </div>
          )}
        </section>
      ) : activeTab === 'categories' ? (
        <section className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{t('common.categoryManagement')}</h2>
              <p className="mt-2 text-slate-600">{t('common.manage_categories_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleCategorySubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              {t('common.categoryName')}
              <input
                className="input-base mt-2"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                required
              />
            </label>
            <label className="field-label">
              {t('common.taxRate')}
              <input
                className="input-base mt-2"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={categoryForm.tax_rate !== undefined ? categoryForm.tax_rate * 100 : ''}
                placeholder=""
                onChange={(event) => setCategoryForm({
                  ...categoryForm,
                  tax_rate: event.target.value === '' ? 0 : Number(event.target.value) / 100,
                })}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('common.currentRate', {
                  rate: (categoryForm.tax_rate !== undefined ? categoryForm.tax_rate * 100 : 10).toFixed(1),
                  raw: (categoryForm.tax_rate !== undefined ? categoryForm.tax_rate : 0.1).toFixed(3),
                })}
              </p>
            </label>

            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button className="button-primary" type="submit" disabled={loading}>
                {categoryForm.id ? t('common.edit') : t('common.register')}
              </button>
              <button type="button" className="button-secondary" onClick={resetCategoryForm}>
                {t('common.reset')}
              </button>
            </div>
            {message ? <p className="sm:col-span-2 text-sm text-slate-700">{message}</p> : null}
          </form>
        </section>
      ) : (
        <section className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{t('common.tableManagement')}</h2>
              <p className="mt-2 text-slate-600">{t('common.manage_tables_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleTableSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              {t('common.tableNumber')}
              <input
                className="input-base mt-2"
                type="text"
                value={tableForm.id}
                placeholder="1"
                onChange={(event) => setTableForm({ ...tableForm, id: event.target.value })}
                required
              />
            </label>
            <label className="field-label">
              {t('common.tableName')}
              <input
                className="input-base mt-2"
                value={tableForm.name}
                onChange={(event) => setTableForm({ ...tableForm, name: event.target.value })}
                required
              />
            </label>
            <label className="field-label">
              {t('common.status')}
              <select
                className="input-base mt-2"
                value={tableForm.status}
                onChange={(event) => setTableForm({ ...tableForm, status: event.target.value as any })}
              >
                <option value="available">{t('common.available')}</option>
                <option value="occupied">{t('common.occupied')}</option>
              </select>
            </label>

            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button className="button-primary" type="submit" disabled={loading}>
                {tableForm.id ? t('common.editTable') : t('common.registerTable')}
              </button>
              <button type="button" className="button-secondary" onClick={resetTableForm}>
                {t('common.reset')}
              </button>
            </div>
            {message ? <p className="sm:col-span-2 text-sm text-slate-700">{message}</p> : null}
          </form>
        </section>
      )}

      {activeTab === 'products' ? (
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{t('common.productList')}</h2>
              <p className="mt-2 text-slate-600">{t('common.viewProductsDesc')}</p>
            </div>
            <button className="button-secondary" onClick={fetchProducts}>
              {t('common.refresh')}
            </button>
          </div>

          {loading ? (
            <div className="text-center text-slate-600">{t('common.loadingProducts')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="flex items-center p-1 border-b border-slate-200">
                    <th className="w-[100px] px-2 py-1">{t('common.photo')}</th>
                    <th className="w-2/6 px-2 py-1">{t('common.productInfo')}</th>
                    <th className="w-1/6 px-2 py-1">{t('common.category')}</th>
                    <th className="w-1/8 px-2 py-1">{t('common.amount')}</th>
                    <th className="w-1/8 px-2 py-1">{t('common.taxRate')}</th>
                    <th className="w-1/8 px-2 py-1">{t('common.stock')}</th>
                    <th className="w-32 px-2 py-1">{t('common.edit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((product) => (
                    <tr key={product.id} className="flex items-center h-24 p-1 border-b border-slate-200">
                      <td className="w-[140px] px-2 py-1">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            style={{
                              width: '100%',
                              height: '140px',
                              objectFit: 'contain',
                              borderRadius: '8px',
                            }}
                          />
                        ) : (
                          <div style={{ height: '140px' }} className="w-full bg-slate-200 rounded flex items-center justify-center text-slate-500">
                            {t('common.noProductImage')}
                          </div>
                        )}
                      </td>
                      <td className="w-2/6 px-2 py-1">
                        <div className="flex flex-col justify-center h-full">
                          <div className="font-medium text-sm">{product.name}</div>
                        </div>
                      </td>
                      <td className="w-1/6 px-2 py-1">
                        <div className="flex flex-col justify-center h-full">
                          <div className="text-xs text-slate-600">{product.category}</div>
                        </div>
                      </td>
                      <td className="w-1/8 px-2 py-1">
                        <div className="flex flex-col justify-center h-full">
                           <div className="text-xs text-slate-600">{product.price.toLocaleString()} {t('common.currency')}</div>
                        </div>
                      </td>
                      <td className="w-1/8 px-2 py-1">
                        <div className="flex flex-col justify-center h-full">
                          <div className="text-xs text-slate-600">
                            {getDisplayTaxRate(product)}
                          </div>
                        </div>
                      </td>
                      <td className="w-1/8 px-2 py-1">
                        <div className="flex flex-col justify-center h-full">
                          <div className="text-xs text-slate-600">{t('common.stock')}: {product.stock}</div>
                        </div>
                      </td>
                      <td className="w-48 px-2 py-1 flex items-center justify-end">
                        <div className="flex gap-3 flex-row">
                          <button
                            className="button-secondary text-xs"
                            style={{
                              padding: '2px 8px',
                              minWidth: '60px',
                              height: '28px',
                              fontSize: '11px',
                            }}
                            onClick={() => handleProductEdit(product)}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            className="button-secondary text-xs"
                            style={{
                              padding: '2px 8px',
                              minWidth: '60px',
                              height: '28px',
                              fontSize: '11px',
                            }}
                            onClick={() => handleProductDelete(product.id)}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : activeTab === 'categories' ? (
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{t('common.categoryList')}</h2>
              <p className="mt-2 text-slate-600">{t('common.viewCategoriesDesc')}</p>
            </div>
            <button className="button-secondary" onClick={fetchCategories}>
              {t('common.refresh')}
            </button>
          </div>

          {loading ? (
            <div className="text-center text-slate-600">{t('common.loadingCategories')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr>
                    <th className="table-header px-4 py-3">{t('common.categoryName')}</th>
                    <th className="table-header px-4 py-3">{t('common.taxRate')}</th>
                    <th className="table-header px-4 py-3">{t('common.edit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="px-4 py-4 text-slate-900">{category.name}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {(category.tax_rate ? category.tax_rate * 100 : 10).toFixed(1)}%
                      </td>
                      <td className="px-4 py-4 space-x-2">
                        <button className="button-secondary" onClick={() => handleCategoryEdit(category)}>
                          {t('common.edit')}
                        </button>
                        <button className="button-secondary" onClick={() => handleCategoryDelete(category.id)}>
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{t('common.tableList')}</h2>
              <p className="mt-2 text-slate-600">{t('common.viewTablesDesc')}</p>
            </div>
            <button className="button-secondary" onClick={fetchTables}>
              {t('common.refresh')}
            </button>
          </div>

          {loading ? (
            <div className="text-center text-slate-600">{t('common.loadingTables')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr>
                    <th className="table-header px-4 py-3">{t('common.number')}</th>
                    <th className="table-header px-4 py-3">{t('common.tableName')}</th>
                    <th className="table-header px-4 py-3">{t('common.status')}</th>
                    <th className="table-header px-4 py-3">{t('common.edit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tables.map((table) => (
                    <tr key={table.id}>
                      <td className="px-4 py-4 text-slate-900">{table.id}</td>
                      <td className="px-4 py-4 text-slate-600">{table.name}</td>
                      <td className="px-4 py-4 text-slate-600">
                        <span className={`px-2 py-1 rounded text-xs ${table.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {table.status === 'available' ? t('common.available') : t('common.occupied')}
                        </span>
                      </td>
                      <td className="px-4 py-4 space-x-2">
                        <button className="button-secondary" onClick={() => handleTableEdit(table)}>
                          {t('common.edit')}
                        </button>
                        <button className="button-secondary" onClick={() => handleTableDelete(table.id)}>
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
