'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth, getAuth } from '@/lib/auth';
import ProductAdmin from '@/components/ProductAdmin';
import SalesHistory from '@/components/SalesHistory';

const tabs = [
  { id: 'products', label: '상품 관리' },
  { id: 'sales', label: '판매 내역' },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('products');
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
  }, [router]);

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 py-16">
        <div className="container">
          <div className="card text-center">관리자 권한 확인 중...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600">관리자 대시보드</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">상품 관리 및 판매 내역</h1>
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
            <button className="button-secondary" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </div>

        {activeTab === 'products' ? <ProductAdmin /> : <SalesHistory />}
      </div>
    </main>
  );
}
