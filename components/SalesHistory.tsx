'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/components/LanguageProvider';

type Sale = {
  id: string;
  created_at: string;
  payment_method: string;
  total_amount: number;
  order_count: number;
  table_id: string | null;
  table_name?: string | null;
};

export default function SalesHistory() {
  const { t, locale } = useLanguage();
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
    try {
      let query = supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00Z`);
      if (toDate) query = query.lte('created_at', `${toDate}T23:59:59Z`);

      const [{ data: salesData, error: salesErr }, { data: tablesData }] = await Promise.all([
        query,
        supabase.from('tables').select('id, name'),
      ]);

      if (salesErr) {
        setMessage(t('common.sales_load_error') + ': ' + salesErr.message);
        return;
      }

      const tablesMap = new Map((tablesData || []).map((t: any) => [String(t.id), t.name as string]));
      const merged: Sale[] = (salesData || []).map((s: any) => ({
        ...s,
        table_name: s.table_id ? (tablesMap.get(String(s.table_id)) ?? null) : null,
      }));
      setSales(merged);
    } catch (e) {
      setMessage(t('common.sales_load_error') + ': ' + String(e));
    } finally {
      setLoading(false);
    }
  }

  const totalSales = useMemo(
    () => sales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
    [sales]
  );

  function methodLabel(method: string) {
    if (method === 'cash') return t('common.cash');
    if (method === 'card') return t('common.card');
    if (method === 'transfer') return t('common.transfer');
    return method;
  }

  function formatLocaleDateTime(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleString(locale === 'ko' ? 'ko-KR' : locale === 'vi' ? 'vi-VN' : 'en-US');
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{t('common.sales_history')}</h2>
            <p className="mt-1 text-slate-600">{t('common.sales_history_desc')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field-label">
              {t('common.start_date')}
              <input className="input-base mt-2" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="field-label">
              {t('common.end_date')}
              <input className="input-base mt-2" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <button type="button" className="button-primary" onClick={fetchSales}>
              {t('common.apply_filter')}
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{t('common.total_payment_count')}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{sales.length}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{t('common.total_sales')}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{totalSales.toLocaleString()} {t('common.currency')}</p>
          </div>
        </div>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}

        {loading ? (
          <p className="text-slate-600">{t('common.loading_sales')}</p>
        ) : sales.length === 0 ? (
          <p className="text-slate-600">{t('common.no_sales_data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="table-header px-4 py-3">{t('common.payment_datetime')}</th>
                  <th className="table-header px-4 py-3">{t('common.table')}</th>
                  <th className="table-header px-4 py-3">{t('common.payment_method')}</th>
                  <th className="table-header px-4 py-3">{t('common.order_count')}</th>
                  <th className="table-header px-4 py-3">{t('common.total_amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-4 text-slate-600">{formatLocaleDateTime(sale.created_at)}</td>
                    <td className="px-4 py-4 font-medium text-slate-900">{sale.table_name || '-'}</td>
                    <td className="px-4 py-4 text-slate-600">{methodLabel(sale.payment_method)}</td>
                    <td className="px-4 py-4 text-slate-600 text-center">{sale.order_count}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{(sale.total_amount || 0).toLocaleString()} {t('common.currency')}</td>
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