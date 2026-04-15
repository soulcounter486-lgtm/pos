'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type OrderItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

type Order = {
  id: string;
  created_at: string;
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  received: number | null;
  change_amount: number | null;
  status: string;
  order_items: OrderItem[];
};

export default function SalesHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    setMessage(null);
    const supabase = getSupabase();
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });

    if (fromDate) {
      query = query.gte('created_at', `${fromDate}T00:00:00Z`);
    }
    if (toDate) {
      query = query.lte('created_at', `${toDate}T23:59:59Z`);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      setMessage('판매 내역을 불러오는 중 오류가 발생했습니다.');
      return;
    }
    setOrders(data || []);
  }

  const totalSales = useMemo(
    () => orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
    [orders]
  );

  const totalCount = orders.length;

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">판매 내역</h2>
            <p className="mt-1 text-slate-600">일별 및 주문별 판매 데이터를 확인하세요.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field-label">
              시작일
              <input className="input-base mt-2" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="field-label">
              종료일
              <input className="input-base mt-2" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <button type="button" className="button-primary" onClick={fetchOrders}>
              필터 적용
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">총 주문 수</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{totalCount}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">총 매출</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{totalSales.toLocaleString()} VND</p>
          </div>
        </div>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}

        {loading ? (
          <p className="text-slate-600">판매 내역을 불러오는 중...</p>
        ) : orders.length === 0 ? (
          <p className="text-slate-600">조회된 주문이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="table-header px-4 py-3">주문일</th>
                  <th className="table-header px-4 py-3">주문 ID</th>
                  <th className="table-header px-4 py-3">결제 수단</th>
                  <th className="table-header px-4 py-3">상품</th>
                  <th className="table-header px-4 py-3">총 금액</th>
                  <th className="table-header px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-4 text-slate-600">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="px-4 py-4 font-medium text-slate-900">{order.id.slice(0, 8)}</td>
                    <td className="px-4 py-4 text-slate-600">{order.payment_method === 'cash' ? '현금' : '카드'}</td>
                    <td className="px-4 py-4 text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {order.order_items.map((item) => (
                          <span key={item.id} className="inline-block bg-slate-100 px-2 py-1 rounded text-xs">
                            {item.quantity} x {(item.unit_price || 0).toLocaleString()} VND
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-900">{(order.total_amount || 0).toLocaleString()} VND</td>
                    <td className="px-4 py-4 text-slate-600">{order.status}</td>
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
