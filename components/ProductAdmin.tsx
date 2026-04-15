'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  barcode?: string;
  stock: number;
  image_url?: string;
  tax_rate?: number;  // Added for tax management
};

type Category = {
  id: string;
  name: string;
  tax_rate?: number;  // Added for tax management
};

type Table = {
  id: number;
  name: string;
  status: 'available' | 'occupied';
};

export default function ProductAdmin() {
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
    tax_rate: 0.1, // Default 10% tax
  });
  const [tableForm, setTableForm] = useState({
    id: 0,
    name: '',
    status: 'available' as 'available' | 'occupied',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      setMessage('상품 목록을 불러오지 못했습니다.');
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
      setMessage('카테고리 목록을 불러오지 못했습니다.');
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
      setMessage('테이블 목록을 불러오지 못했습니다.');
      return;
    }
    setTables(data || []);
    if (!data || data.length === 0) {
      setMessage('등록된 테이블이 없습니다.');
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
    setTableForm({ id: 0, name: '', status: 'available' });
    setMessage(null);
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setMessage(`이미지 선택됨: ${file.name}`);
  }

  async function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!productForm.name || !productForm.category || productForm.price <= 0 || productForm.stock < 0) {
      setMessage('상품명, 카테고리, 가격, 재고를 정확히 입력해주세요.');
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
        setMessage('이미지 업로드 실패: ' + uploadError.message);
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
        setMessage('상품 수정 중 오류가 발생했습니다: ' + error.message);
        return;
      }
      setMessage('상품이 수정되었습니다.');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      setLoading(false);
      if (error) {
        console.error('Insert error:', error);
        setMessage('상품 등록 중 오류가 발생했습니다: ' + error.message);
        return;
      }
      setMessage('상품이 등록되었습니다.');
    }

    resetProductForm();
    setIsModalOpen(false);
    fetchProducts();
  }

  async function handleCategorySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!categoryForm.name) {
      setMessage('카테고리 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    const payload = {
      name: categoryForm.name,
      tax_rate: categoryForm.tax_rate || 0.1,
    };

    if (categoryForm.id) {
      // Update existing category
      const { error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', categoryForm.id);
      setLoading(false);
      if (error) {
        setMessage('카테고리 수정 중 오류가 발생했습니다.');
        return;
      }
      setMessage('카테고리가 수정되었습니다.');

      // Update all products in this category
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
      // Insert new category
      const { error } = await supabase.from('categories').insert(payload);
      setLoading(false);
      if (error) {
        setMessage('카테고리 등록 중 오류가 발생했습니다.');
        return;
      }
      setMessage('카테고리가 등록되었습니다.');
    }

    resetCategoryForm();
    fetchCategories();
    fetchProducts(); // Refresh product list to show updated tax rates
  }

  async function handleTableSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!tableForm.name) {
      setMessage('테이블 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    const payload = {
      id: tableForm.id,
      name: tableForm.name,
      status: tableForm.status,
    };

    if (tableForm.id) {
      const { error } = await supabase.from('tables').update(payload).eq('id', tableForm.id);
      setLoading(false);
      if (error) {
        setMessage('테이블 수정 중 오류가 발생했습니다.');
        return;
      }
      setMessage('테이블이 수정되었습니다.');
    } else {
      const { error } = await supabase.from('tables').insert(payload);
      setLoading(false);
      if (error) {
        setMessage('테이블 등록 중 오류가 발생했습니다.');
        return;
      }
      setMessage('테이블이 등록되었습니다.');
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
      setMessage('상품 삭제 중 오류가 발생했습니다.');
      return;
    }
    setMessage('상품이 삭제되었습니다.');
    fetchProducts();
  }

  async function handleCategoryDelete(id: string) {
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('categories').delete().eq('id', id);
    setLoading(false);
    if (error) {
      setMessage('카테고리 삭제 중 오류가 발생했습니다.');
      return;
    }
    setMessage('카테고리가 삭제되었습니다.');
    fetchCategories();
  }

  async function handleTableDelete(id: number) {
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('tables').delete().eq('id', id);
    setLoading(false);
    if (error) {
      setMessage('테이블 삭제 중 오류가 발생했습니다.');
      return;
    }
    setMessage('테이블이 삭제되었습니다.');
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
    setMessage('편집 모드입니다. 저장하면 수정됩니다.');
    setIsModalOpen(true);
  }

  function handleCategoryEdit(category: Category) {
    setCategoryForm({ 
      id: category.id,
      name: category.name, 
      tax_rate: category.tax_rate ?? 0
    });
    setMessage('편집 모드입니다. 저장하면 수정됩니다.');
  }

  function handleTableEdit(table: Table) {
    setTableForm({
      id: table.id,
      name: table.name,
      status: table.status,
    });
    setMessage('편집 모드입니다. 저장하면 수정됩니다.');
  }

  const stockSummary = useMemo(() => {
    return products.reduce((acc, product) => acc + product.stock, 0);
  }, [products]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(cat => map.set(cat.name, cat));
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
    return '기본';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'products' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveTab('products')}
        >
          상품 관리
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'categories' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveTab('categories')}
        >
          카테고리 관리
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'tables' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveTab('tables')}
        >
          테이블 관리
        </button>
      </div>

      {activeTab === 'products' ? (
        <section className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">상품 관리</h2>
              <p className="mt-2 text-slate-600">상품 정보를 등록하거나 기존 상품을 수정 및 삭제할 수 있습니다.</p>
            </div>
            <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              전체 재고: {stockSummary}개
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
              상품 등록
            </button>
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-4">상품 등록</h3>
                <form onSubmit={handleProductSubmit} className="grid gap-4">
                  <label className="field-label">
                    상품명
                    <input
                      className="input-base mt-2"
                      value={productForm.name}
                      onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                      required
                    />
                  </label>
                  <label className="field-label">
                    카테고리
                    <select
                      className="input-base mt-2"
                      value={productForm.category}
                      onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                      required
                    >
                      <option value="">카테고리 선택</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    가격
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
                    재고 수량
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
                    바코드 (선택)
                    <input
                      className="input-base mt-2"
                      value={productForm.barcode}
                      onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })}
                    />
                  </label>
                  <label className="field-label">
                    부가세율 (%) (선택)
                    <input
                      className="input-base mt-2"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={productForm.tax_rate !== undefined ? productForm.tax_rate * 100 : ''}
                      placeholder="카테고리 기본값 사용"
                      onChange={(event) => setProductForm({ 
                        ...productForm, 
                        tax_rate: event.target.value === '' ? undefined : Number(event.target.value) / 100 
                      })}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {productForm.tax_rate !== undefined 
                        ? `개별 설정: ${(productForm.tax_rate * 100).toFixed(1)}%` 
                        : '카테고리 기본 부가세율 사용'}
                    </p>
                  </label>
                  <label className="field-label">
                    이미지 (선택)
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
                      {imageFile && <p className="mt-2 text-sm text-slate-600">선택됨: {imageFile.name}</p>}
                    </div>
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button className="button-primary" type="submit" disabled={loading}>
                      등록
                    </button>
                    <button type="button" className="button-secondary" onClick={() => setIsModalOpen(false)}>
                      취소
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
              <h2 className="text-2xl font-semibold text-slate-900">카테고리 관리</h2>
              <p className="mt-2 text-slate-600">카테고리를 등록하거나 기존 카테고리를 삭제할 수 있습니다.</p>
            </div>
          </div>

          <form onSubmit={handleCategorySubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              카테고리 이름
              <input
                className="input-base mt-2"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                required
              />
            </label>
            <label className="field-label">
              부가세율 (%)
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
                  tax_rate: event.target.value === '' ? 0 : Number(event.target.value) / 100
                })}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                현재: {(categoryForm.tax_rate !== undefined ? categoryForm.tax_rate * 100 : 10).toFixed(1)}% ({(categoryForm.tax_rate !== undefined ? categoryForm.tax_rate : 0.1).toFixed(3)})
              </p>
            </label>

            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button className="button-primary" type="submit" disabled={loading}>
                카테고리 등록
              </button>
              <button type="button" className="button-secondary" onClick={resetCategoryForm}>
                초기화
              </button>
            </div>
            {message ? <p className="sm:col-span-2 text-sm text-slate-700">{message}</p> : null}
          </form>
        </section>
      ) : (
        <section className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">테이블 관리</h2>
              <p className="mt-2 text-slate-600">테이블을 등록하거나 기존 테이블을 수정 및 삭제할 수 있습니다.</p>
            </div>
          </div>

          <form onSubmit={handleTableSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              테이블 번호
              <input
                className="input-base mt-2"
                type="number"
                min="1"
                value={tableForm.id || ''}
                placeholder="1"
                onChange={(event) => setTableForm({ ...tableForm, id: Number(event.target.value) || 0 })}
                required
              />
            </label>
            <label className="field-label">
              테이블 이름
              <input
                className="input-base mt-2"
                value={tableForm.name}
                onChange={(event) => setTableForm({ ...tableForm, name: event.target.value })}
                required
              />
            </label>
            <label className="field-label">
              상태
              <select
                className="input-base mt-2"
                value={tableForm.status}
                onChange={(event) => setTableForm({ ...tableForm, status: event.target.value as any })}
              >
                <option value="available">사용 가능</option>
                <option value="occupied">사용 중</option>
              </select>
            </label>

            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button className="button-primary" type="submit" disabled={loading}>
                {tableForm.id ? '테이블 수정' : '테이블 등록'}
              </button>
              <button type="button" className="button-secondary" onClick={resetTableForm}>
                초기화
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
              <h2 className="text-2xl font-semibold text-slate-900">상품 목록</h2>
              <p className="mt-2 text-slate-600">등록된 상품을 조회하고 수정 또는 삭제할 수 있습니다.</p>
            </div>
            <button className="button-secondary" onClick={fetchProducts}>
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="text-center text-slate-600">상품을 불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="flex items-center p-1 border-b border-slate-200">
                    <th className="w-[100px] px-2 py-1">사진</th>
                    <th className="w-2/6 px-2 py-1">상품정보</th>
                    <th className="w-1/6 px-2 py-1">카테고리</th>
                    <th className="w-1/8 px-2 py-1">금액</th>
                    <th className="w-1/8 px-2 py-1">부가세율</th>
                    <th className="w-1/8 px-2 py-1">재고</th>
                    <th className="w-32 px-2 py-1">작업</th>
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
                              borderRadius: '8px'
                            }}
                          />
                        ) : (
                          <div style={{ height: '140px' }} className="w-full bg-slate-200 rounded flex items-center justify-center text-slate-500">
                            상품 없음
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
                          <div className="text-xs text-slate-600">{product.price.toLocaleString()} VND</div>
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
                          <div className="text-xs text-slate-600">재고: {product.stock}</div>
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
                              fontSize: '11px'
                            }}
                            onClick={() => handleProductEdit(product)}
                          >
                            수정
                          </button>
                          <button 
                            className="button-secondary text-xs"
                            style={{ 
                              padding: '2px 8px', 
                              minWidth: '60px',
                              height: '28px',
                              fontSize: '11px'
                            }}
                            onClick={() => handleProductDelete(product.id)}
                          >
                            삭제
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
              <h2 className="text-2xl font-semibold text-slate-900">카테고리 목록</h2>
              <p className="mt-2 text-slate-600">등록된 카테고리를 조회하고 삭제할 수 있습니다.</p>
            </div>
            <button className="button-secondary" onClick={fetchCategories}>
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="text-center text-slate-600">카테고리 불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr>
                    <th className="table-header px-4 py-3">카테고리 이름</th>
                    <th className="table-header px-4 py-3">부가세율</th>
                    <th className="table-header px-4 py-3">작업</th>
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
                          수정
                        </button>
                        <button className="button-secondary" onClick={() => handleCategoryDelete(category.id)}>
                          삭제
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
              <h2 className="text-2xl font-semibold text-slate-900">테이블 목록</h2>
              <p className="mt-2 text-slate-600">등록된 테이블을 조회하고 수정 또는 삭제할 수 있습니다.</p>
            </div>
            <button className="button-secondary" onClick={fetchTables}>
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="text-center text-slate-600">테이블을 불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr>
                    <th className="table-header px-4 py-3">번호</th>
                    <th className="table-header px-4 py-3">이름</th>
                    <th className="table-header px-4 py-3">상태</th>
                    <th className="table-header px-4 py-3">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tables.map((table) => (
                    <tr key={table.id}>
                      <td className="px-4 py-4 text-slate-900">{table.id}</td>
                      <td className="px-4 py-4 text-slate-600">{table.name}</td>
                      <td className="px-4 py-4 text-slate-600">
                        <span className={`px-2 py-1 rounded text-xs ${table.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {table.status === 'available' ? '사용 가능' : '사용 중'}
                        </span>
                      </td>
                      <td className="px-4 py-4 space-x-2">
                        <button className="button-secondary" onClick={() => handleTableEdit(table)}>
                          수정
                        </button>
                        <button className="button-secondary" onClick={() => handleTableDelete(table.id)}>
                          삭제
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