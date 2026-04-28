import ko from '../locales/ko.json';
import vi from '../locales/vi.json';
import en from '../locales/en.json';

export type Locale = 'ko' | 'vi' | 'en';

export const translations = { ko, vi, en };

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const keys = key.split('.');
  let val: any = translations[locale];
  for (const k of keys) {
    if (val == null) break;
    val = val[k];
  }
  if (typeof val !== 'string') {
    return key;
  }
  if (!vars) return val;
  return val.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  vi: 'Tiếng Việt',
  en: 'English',
};