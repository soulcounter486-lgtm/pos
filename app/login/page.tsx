'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAuth } from '@/lib/auth';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

const credentials: Record<string, string> = {
  phocha: '1324',
  admin: '123456',
  bep: '1324', // Kitchen account
};

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    const expectedPassword = credentials[userId];
    if (!expectedPassword || expectedPassword !== password) {
      setError(t('common.login_invalid_credentials'));
      setLoading(false);
      return;
    }

    // Role determination: bep is kitchen, others are admin or staff
    let role: 'admin' | 'staff' | 'kitchen';
    if (userId === 'bep') {
      role = 'kitchen';
    } else {
      role = userId === 'admin' ? 'admin' : 'staff';
    }
    
    // kitchen uses localStorage, others use setAuth
    if (role === 'kitchen') {
      localStorage.setItem('auth', JSON.stringify({ role, username: userId }));
    } else {
      setAuth(role, userId);
    }
    
    setLoading(false);
    
    // Navigate based on role
    if (role === 'kitchen') {
      router.replace('/kitchen/orders');
    } else {
      router.replace(role === 'admin' ? '/admin' : '/staff');
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#c9e6ff] via-[#b8d0ff] to-[#c9bcff] p-4 text-slate-700">
      <div className="pointer-events-none absolute -left-28 top-14 h-80 w-80 rounded-full bg-white/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-6 h-72 w-72 rounded-full bg-[#d6ccff]/45 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-60 w-60 -translate-x-1/2 rounded-full bg-[#8ad7ff]/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl items-center justify-center gap-6">
        <section className="hidden w-full max-w-xs rounded-[2rem] border border-white/40 bg-white/20 p-10 shadow-[0_28px_60px_rgba(124,145,205,0.35)] backdrop-blur-2xl lg:block">
          <div className="mb-14 flex h-36 items-center justify-center rounded-[1.6rem] bg-white/20">
            <div className="relative">
              <div className="h-14 w-20 rounded-full bg-white/85 shadow-lg" />
              <div className="absolute -right-4 -top-2 h-9 w-9 rounded-full bg-[#ffe98a]/90" />
            </div>
          </div>
          <h2 className="text-4xl font-light leading-tight text-white/90">POS {t('common.settings')}</h2>
          <p className="mt-6 text-white/85">{t('common.staff')} & {t('common.admin')} {t('common.login')}</p>
        </section>

        <section className="w-full max-w-md">
          <div className="mb-4 flex justify-end">
            <div className="rounded-full border border-white/40 bg-white/20 px-3 py-1 backdrop-blur-xl">
              <LanguageSelector />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/40 bg-white/25 p-8 shadow-[0_28px_70px_rgba(124,145,205,0.4)] backdrop-blur-2xl sm:p-10">
            <div className="mb-8 flex items-center justify-between text-[#4f7095]">
              <button type="button" className="text-lg leading-none opacity-70" aria-hidden="true">
                ⋮
              </button>
              <p className="text-xl font-semibold tracking-wide">{t('common.login')}</p>
              <button type="button" className="text-2xl leading-none opacity-70" aria-hidden="true">
                +
              </button>
            </div>

            <div className="mb-8 text-center">
              <p className="text-7xl font-semibold leading-none text-[#5a9dd6] drop-shadow-[0_8px_20px_rgba(107,163,219,0.35)]">POS</p>
              <p className="mt-2 text-2xl font-medium text-[#4f7095]">{t('common.settings')}</p>
              <p className="mt-1 text-sm text-[#6887a7]">{t('common.login_enter_account_info')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#54708f]">{t('common.user_id')}</label>
                <input
                  className="block w-full rounded-2xl border border-white/45 bg-white/45 px-4 py-3 text-slate-700 placeholder:text-slate-400 shadow-[0_10px_20px_rgba(136,167,220,0.2)] transition focus:border-[#77b7ea] focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#9bd7ff]/60"
                  type="text"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  placeholder={t('common.enter_user_id')}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#54708f]">{t('common.password')}</label>
                <input
                  className="block w-full rounded-2xl border border-white/45 bg-white/45 px-4 py-3 text-slate-700 placeholder:text-slate-400 shadow-[0_10px_20px_rgba(136,167,220,0.2)] transition focus:border-[#77b7ea] focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#9bd7ff]/60"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('common.enter_password')}
                  required
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  {t('common.login_invalid_credentials')}
                </div>
              )}

              <button
                className="mt-2 w-full rounded-full bg-gradient-to-r from-[#79def7] to-[#7ec2ff] px-6 py-3 text-base font-semibold text-white shadow-[0_14px_26px_rgba(102,170,236,0.45)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? t('common.logging_in') : t('common.login')}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center text-sm text-white/70">
            © 2024 POS System. All rights reserved.
          </div>
        </section>
      </div>
      <div className="hidden lg:block">
        <div className="pointer-events-none absolute right-14 top-16 grid grid-cols-3 gap-6 text-white/75">
          <span className="text-4xl">☀️</span>
          <span className="text-4xl">🌙</span>
          <span className="text-4xl">☁️</span>
          <span className="text-4xl">☁️</span>
          <span className="text-4xl">☁️</span>
          <span className="text-4xl">☁️</span>
          <span className="text-4xl">☁️</span>
          <span className="text-4xl">☁️</span>
          <span className="text-4xl">☁️</span>
        </div>
      </div>
    </main>
  );
}