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
};

export default function ProductAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    id: '',
    name: '',
    category: '',
    price: 0,
    barcode: '',
    stock: 0,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
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

  function resetForm() {
    setForm({ id: '', name: '', category: '', price: 0, barcode: '', stock: 0 });
    setMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!form.name || !form.category || form.price <= 0 || form.stock < 0) {
      setMessage('상품명, 카테고리, 가격, 재고를 정확히 입력해주세요.');
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    const payload = {
      name: form.name,
      category: form.category,
      price: form.price,
      barcode: form.barcode || null,
      stock: form.stock,
    };

    if (form.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', form.id);
      setLoading(false);
      if (error) {
        setMessage('상품 수정 중 오류가 발생했습니다.');
        return;
      }
      setMessage('상품이 수정되었습니다.');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      setLoading(false);
      if (error) {
        setMessage('상품 등록 중 오류가 발생했습니다.');
        return;
      }
      setMessage('상품이 등록되었습니다.');
    }

    resetForm();
    fetchProducts();
  }

  async function handleDelete(id: string) {
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

  function handleEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      barcode: product.barcode ?? '',
      stock: product.stock,
    });
    setMessage('편집 모드입니다. 저장하면 수정됩니다.');
  }

  const stockSummary = useMemo(() => {
    return products.reduce((acc, product) => acc + product.stock, 0);
  }, [products]);

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">상품 등록 / 수정</h2>
            <p className="mt-2 text-slate-600">상품 정보를 등록하거나 기존 상품을 수정 및 삭제할 수 있습니다.</p>
          </div>
          <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            전체 재고: {stockSummary}개
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            상품명
            <input
              className="input-base mt-2"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label className="field-label">
            카테고리
            <input
              className="input-base mt-2"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              required
            />
          </label>
          <label className="field-label">
            가격
            <input
              className="input-base mt-2"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
              required
            />
          </label>
          <label className="field-label">
            재고 수량
            <input
              className="input-base mt-2"
              type="number"
              min="0"
              value={form.stock}
              onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })}
              required
            />
          </label>
          <label className="field-label sm:col-span-2">
            바코드 (선택)
            <input
              className="input-base mt-2"
              value={form.barcode}
              onChange={(event) => setForm({ ...form, barcode: event.target.value })}
            />
          </label>

          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button className="button-primary" type="submit" disabled={loading}>
              {form.id ? '상품 수정' : '상품 등록'}
            </button>
            <button type="button" className="button-secondary" onClick={resetForm}>
              초기화
            </button>
          </div>
          {message ? <p className="sm:col-span-2 text-sm text-slate-700">{message}</p> : null}
        </form>
      </section>

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
                <tr>
                  <th className="table-header px-4 py-3">상품명</th>
                  <th className="table-header px-4 py-3">카테고리</th>
                  <th className="table-header px-4 py-3">가격</th>
                  <th className="table-header px-4 py-3">재고</th>
                  <th className="table-header px-4 py-3">바코드</th>
                  <th className="table-header px-4 py-3">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-4 text-slate-900">{product.name}</td>
                    <td className="px-4 py-4 text-slate-600">{product.category}</td>
                    <td className="px-4 py-4 text-slate-600">{product.price.toLocaleString()}원</td>
                    <td className="px-4 py-4 text-slate-600">{product.stock}</td>
                    <td className="px-4 py-4 text-slate-600">{product.barcode || '-'}</td>
                    <td className="px-4 py-4 space-x-2">
                      <button className="button-secondary" onClick={() => handleEdit(product)}>
                        수정
                      </button>
                      <button className="button-secondary" onClick={() => handleDelete(product.id)}>
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
    </div>
  );
}
