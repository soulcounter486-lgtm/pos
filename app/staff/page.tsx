'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth, getAuth } from '@/lib/auth';
import StaffPos from '@/components/StaffPos';

export default function StaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function verifyStaff() {
      const { role } = getAuth();
      if (role !== 'staff') {
        router.push('/login');
        return;
      }
      setLoading(false);
    }

    verifyStaff();
  }, [router]);

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-semibold text-lg">POS 시스템</h1>
                <p className="text-gray-400 text-sm">직원 모드</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-white text-sm">직원: phocha</p>
              <p className="text-gray-400 text-xs">2024-01-11 14:30:25</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <StaffPos />
    </div>
  );
}
