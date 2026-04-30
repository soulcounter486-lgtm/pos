'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth, getAuth } from '@/lib/auth';
import StaffPos from '@/components/StaffPos';
import { getSupabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/components/LanguageProvider';
import { Locale } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';

export default function StaffPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [userId, setUserId] = useState('');
  const [now, setNow] = useState('');
  const [loading, setLoading] = useState(true);
  const [headerText, setHeaderText] = useState('');

  useEffect(() => {
    const { role, userId: uid } = getAuth();
    if (role !== 'staff' && role !== 'admin') {
      router.replace('/login');
      return;
    }
    setUserId(uid || '');
    setLoading(false);

    // Real-time clock
    const tick = () => setNow(new Date().toLocaleString(locale === 'ko' ? 'ko-KR' : locale === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    tick();
    const timer = setInterval(tick, 60000);

    // Header text: always use i18n translation
    setHeaderText(t('common.staff_pos'));

    return () => clearInterval(timer);
  }, [router, locale, t]);

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <header className="relative z-50 flex-shrink-0 border-b border-white/40 bg-white/20 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="text-[#1f3557] font-black text-sm md:text-base whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">{headerText}</h1>
              <p className="text-[#4f7095]/80 text-[10px] md:text-xs">{t('common.staff_mode')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <LanguageSelector />
            <div className="text-right hidden sm:block">
              <p className="text-[#2f4f74] text-xs">{t('common.staff')}: {userId}</p>
              <p className="text-[#5f7f9f] text-[10px]">{now}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-rose-500/85 hover:bg-rose-500 text-white px-2 py-1.5 rounded-xl text-[10px] md:text-sm font-medium transition-colors flex-shrink-0 shadow-sm"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">
        <StaffPos />
      </div>
    </div>
  );
}
