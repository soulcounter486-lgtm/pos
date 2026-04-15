'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Sale = {
  id: string;
  created_at: string;
  payment_method: string;
  total_amount: number;
  order_count: number;
  table_id: string | null;
  tables?: { name: string } | null;
};

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    setMessage(null);
    const supabase = getSupabase();
    let query = supabase
      .from('sales')
      .select('*, tables(name)')
      .order('created_at', { ascending: false });

    if (fromDate) {
      query = query.gte('created_at', `${fromDate}T00:00:00Z`);
    }
    if (toDate) {
      query = query.lte('created_at', `${toDate}T23:59:59Z`);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      setMessage('판매 내역을 불러오는 중 오류가 발생했습니다: ' + error.message);
      return;
    }
    setSales(data || []);
  }

  const totalSales = useMemo(
    () => sales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
    [sales]
  );

  function methodLabel(method: string) {
    if (method === 'cash') return '현금';
    if (method === 'card') return '카드';
    if (method === 'transfer') return '계좌이체';
    return method;
  }

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">판매 내역</h2>
            <p className="mt-1 text-slate-600">결제 완료된 주문 내역을 확인하세요.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field-label">
              시작일
              <input className="input-base mt-2" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="field-label">
              종료일
              <input className="input-base mt-2" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <button type="button" className="button-primary" onClick={fetchSales}>
              필터 적용
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">총 결제 건수</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{sales.length}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">총 매출</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{totalSales.toLocaleString()} VND</p>
          </div>
        </div>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}

        {loading ? (
          <p className="text-slate-600">판매 내역을 불러오는 중...</p>
        ) : sales.length === 0 ? (
          <p className="text-slate-600">조회된 결제 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="table-header px-4 py-3">결제 일시</th>
                  <th className="table-header px-4 py-3">테이블</th>
                  <th className="table-header px-4 py-3">결제 수단</th>
                  <th className="table-header px-4 py-3">주문 수</th>
                  <th className="table-header px-4 py-3">총 금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-4 text-slate-600">{new Date(sale.created_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-4 font-medium text-slate-900">{sale.tables?.name || '-'}</td>
                    <td className="px-4 py-4 text-slate-600">{methodLabel(sale.payment_method)}</td>
                    <td className="px-4 py-4 text-slate-600 text-center">{sale.order_count}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{(sale.total_amount || 0).toLocaleString()} VND</td>
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
