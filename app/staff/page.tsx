'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth, getAuth } from '@/lib/auth';
import StaffPos from '@/components/StaffPos';
import { getSupabase } from '@/lib/supabaseClient';

export default function StaffPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [now, setNow] = useState('');
  const [loading, setLoading] = useState(true);
  const [headerText, setHeaderText] = useState('POS 시스템');

  useEffect(() => {
    const { role, userId: uid } = getAuth();
    if (role !== 'staff' && role !== 'admin') {
      router.replace('/login');
      return;
    }
    setUserId(uid || '');
    setLoading(false);

    // 실시간 시계
    const tick = () => setNow(new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    tick();
    const timer = setInterval(tick, 60000);

    // 설정 불러오기
    const supabase = getSupabase();
    supabase.from('settings').select('staff_header_text').eq('id', 'default').single().then(({ data }) => {
      if (data?.staff_header_text) setHeaderText(data.staff_header_text);
    });

    return () => clearInterval(timer);
  }, [router]);

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-white font-semibold text-lg whitespace-pre-line">{headerText}</h1>
              <p className="text-gray-400 text-sm">직원 모드</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-white text-sm">직원: {userId}</p>
              <p className="text-gray-400 text-xs">{now}</p>
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
      <StaffPos />
    </div>
  );
}
