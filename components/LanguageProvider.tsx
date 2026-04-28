'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Locale, t as translate, localeNames } from '@/lib/i18n';

const STORAGE_KEY = 'pos_locale';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  localeNames: Record<Locale, string>;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'ko',
  setLocale: () => {},
  t: (key: string) => key,
  localeNames,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ko');
  const [mounted, setMounted] = useState(false);
  const currentLocaleRef = useRef<Locale>('ko');

  // locale이 변경될 때마다 ref 업데이트
  useEffect(() => {
    currentLocaleRef.current = locale;
  }, [locale]);

  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window === 'undefined') return;

    setMounted(true);

    // localStorage에서 저장된 언어 불러오기
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;

      // 저장된 값이 있으면 우선 사용, 없으면 기본값 'ko'
      let initialLocale: Locale = 'ko';
      if (saved && ['ko', 'vi', 'en'].includes(saved)) {
        initialLocale = saved;
      }

      // 강제: localStorage 값을 항상 'ko'로 설정 (필요시 주석 처리)
      // localStorage.setItem(STORAGE_KEY, 'ko');

      setLocaleState(initialLocale);
      currentLocaleRef.current = initialLocale;

      console.log(`[i18n] Initialized with locale: ${initialLocale} (saved: ${saved || 'none'})`);
    } catch (error) {
      console.error('[i18n] Failed to load locale from localStorage:', error);
      setLocaleState('ko');
      currentLocaleRef.current = 'ko';
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    if (typeof window === 'undefined') return;

    try {
      console.log(`[i18n] Changing locale from ${currentLocaleRef.current} to ${newLocale}`);

      // 즉시 localStorage 동기화
      localStorage.setItem(STORAGE_KEY, newLocale);

      // 상태 업데이트
      setLocaleState(newLocale);
      currentLocaleRef.current = newLocale;

      console.log(`[i18n] Locale successfully changed to ${newLocale}, localStorage updated`);
    } catch (error) {
      console.error('[i18n] Failed to save locale to localStorage:', error);
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const result = translate(locale, key, vars);

      // 디버깅: 키가 번역되지 않았을 때 로그 (개발 모드에서만)
      if (process.env.NODE_ENV === 'development' && result === key && typeof window !== 'undefined') {
        console.warn(`[i18n] Untranslated key: "${key}" for locale: "${locale}"`);
      }

      return result;
    },
    [locale]  // locale发生变化时重新创建t函数
  );

  // 초기 로딩 중에는 기본값으로 렌더링
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{
        locale: 'ko',
        setLocale: () => {},
        t: (key, vars) => translate('ko', key, vars),
        localeNames
      }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, localeNames }}>
      {children}
    </LanguageContext.Provider>
  );
}
