'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { useLanguage } from '@/components/LanguageProvider';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const { role } = getAuth();
    if (role === 'staff') {
      router.replace('/staff');
    } else if (role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg">{t('common.loading')}</p>
      </div>
    </div>
  );
}
