'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth, getAuth } from '@/lib/auth';
import ProductAdmin from '@/components/ProductAdmin';
import SalesHistory from '@/components/SalesHistory';
import AdminSettings from '@/components/AdminSettings';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

export default function AdminPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const tabs = useMemo(() => [
    { id: 'products' as const, label: t('common.product') },
    { id: 'sales' as const, label: t('common.sales_history') },
    { id: 'settings' as const, label: t('common.settings') },
  ], [t, locale]);
  const [activeTab, setActiveTab] = useState<'products' | 'sales' | 'settings'>('products');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function verifyAdmin() {
      const { role } = getAuth();
      if (role !== 'admin') {
        router.push('/login');
        return;
      }
      setLoading(false);
    }

    verifyAdmin();
  }, [router, locale]); // Add locale to re-render when language changes

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="container">
          <div className="card text-center">{t('common.loading')}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600">{t('common.admin')} Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{t('common.product')} & {t('common.sales_history')}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={
                  activeTab === tab.id
                    ? 'button-primary'
                    : 'button-secondary'
                }
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <LanguageSelector />
            <button className="button-secondary" onClick={handleLogout}>
              {t('common.logout')}
            </button>
          </div>
        </div>

        {activeTab === 'products' && <ProductAdmin />}
        {activeTab === 'sales' && <SalesHistory />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </main>
  );
}
