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
      <main className="min-h-screen bg-white py-16">
        <div className="container">
          <div className="card text-center">{t('common.loading')}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* 슬림 상단바 */}
      <header className="sticky top-0 z-40 border-b border-[#d9ebff] bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-[#5f95ca] hidden sm:block whitespace-nowrap">{t('common.admin')}</span>
            <div className="flex gap-1 flex-shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-[#78b6f1] text-white'
                      : 'text-slate-600 hover:bg-[#eef6ff]'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LanguageSelector />
            <button
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-[#eef6ff] transition-colors whitespace-nowrap flex-shrink-0"
              onClick={handleLogout}
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {activeTab === 'products' && <ProductAdmin />}
        {activeTab === 'sales' && <SalesHistory />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </main>
  );
}
