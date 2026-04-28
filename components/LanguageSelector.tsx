'use client';

import { useState } from 'react';
import { useLanguage } from './LanguageProvider';
import { Locale } from '@/lib/i18n';

export default function LanguageSelector({ className = '' }: { className?: string }) {
  const { locale, setLocale, localeNames } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = (l: Locale) => {
    setLocale(l);
    setOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
       <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm">🌐</span>
          <span className="inline max-w-20 truncate">{localeNames[locale]}</span>
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 z-40 overflow-hidden">
            {(['ko', 'vi', 'en'] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => handleSelect(l)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  locale === l
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {localeNames[l]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
