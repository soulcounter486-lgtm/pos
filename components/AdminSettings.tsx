'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { useLanguage } from './LanguageProvider';
import type { Settings } from '@/types';

export default function AdminSettings() {
  const { t } = useLanguage();
  const [form, setForm] = useState<Settings>({
    bank_name: '',
    account_number: '',
    account_holder: '',
    receipt_header: t('common.pos_restaurant'),
    staff_header_text: t('common.company_icon_pos'),
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [hasStaffHeaderCol, setHasStaffHeaderCol] = useState<boolean | null>(null);

  useEffect(() => {
    checkColumnAndLoad();
  }, []);

  useEffect(() => {
    if (message) {
      const tm = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(tm);
    }
  }, [message]);

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage(text);
    setMessageType(type);
  }

  async function checkColumnAndLoad() {
    setLoading(true);
    try {
      const res = await fetch('/api/migrate-settings');
      if (res.ok) {
        const info = await res.json();
        setHasStaffHeaderCol(info.hasStaffHeaderColumn);
      }
    } catch (e) {
      console.warn('migration API call failed:', e);
    }
    await fetchSettings();
    setLoading(false);
  }

  async function fetchSettings() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'default').single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setForm({
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          account_holder: data.account_holder || '',
          receipt_header: data.receipt_header || t('common.pos_restaurant'),
          staff_header_text: data.staff_header_text || t('common.company_icon_pos'),
        });
        if (hasStaffHeaderCol === null) {
          setHasStaffHeaderCol('staff_header_text' in data);
        }
      }
    } catch (e) {
      console.error('settings fetch error:', e);
      showMsg(t('common.settings_load_failed'), 'error');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { bank_name, account_number, account_holder, receipt_header, staff_header_text } = form;

      const fullPayload = {
        id: 'default',
        bank_name,
        account_number,
        account_holder,
        receipt_header,
        staff_header_text,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('settings').upsert(fullPayload);

      const isColErr = (err: typeof error) =>
        !!err && (err.code === '42703' || /Could not find.*column|staff_header_text/i.test(err.message || ''));

      if (isColErr(error)) {
        const basePayload = { id: 'default', bank_name, account_number, account_holder, receipt_header, updated_at: new Date().toISOString() };
        const { error: e2 } = await supabase.from('settings').upsert(basePayload);
        if (e2) throw e2;
        setHasStaffHeaderCol(false);
        showMsg(t('common.settings_saved_partial'), 'error');
        setLoading(false);
        return;
      }

      if (error) throw error;

      setHasStaffHeaderCol(true);
      await fetchSettings();
      showMsg(t('common.settings_saved'));
    } catch (e: unknown) {
      console.error('settings save error:', e);
      const msg = e instanceof Error ? e.message : String(e);
      showMsg(t('common.settings_save_failed') + msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${messageType === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-[#eef6ff] text-[#4f8fcb]'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 영수증 헤더 */}
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">{t('common.receipt')} {t('common.settings')}</h2>
          <p className="text-sm text-slate-500 mb-5">{t('common.receipt')} {t('common.settings')}</p>
          <label className="field-label">
            {t('common.receipt_header')}
            <input
              className="input-base mt-2"
              value={form.receipt_header}
              onChange={e => setForm({ ...form, receipt_header: e.target.value })}
              placeholder={t('common.receipt_header')}
            />
          </label>
        </div>

        {/* 직원 메인 헤더 */}
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">{t('common.staff_header_setting')}</h2>
          <p className="text-sm text-slate-500 mb-5">{t('common.staff_header_desc')}</p>
          <label className="field-label">
            {t('common.staff_header_label')}
            <textarea
              className="input-base mt-2 resize-none"
              rows={3}
              value={form.staff_header_text}
              onChange={e => setForm({ ...form, staff_header_text: e.target.value })}
              placeholder={t('common.staff_header_placeholder')}
            />
          </label>
          {hasStaffHeaderCol === false && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-xs text-rose-700 font-semibold mb-2">{t('common.db_column_needed')}</p>
              <p className="text-xs text-rose-600 mb-2">{t('common.db_column_sql_guide')}</p>
              <pre className="text-xs bg-white rounded p-2 border border-rose-200 text-slate-700 font-mono overflow-x-auto">
                {`ALTER TABLE settings\n  ADD COLUMN IF NOT EXISTS staff_header_text\n  text NOT NULL DEFAULT '${t('common.company_icon_pos')}';`}
              </pre>
            </div>
          )}
          {hasStaffHeaderCol === true && (
            <p className="mt-2 text-xs text-green-600">{t('common.db_column_ok')}</p>
          )}
        </div>

        {/* 은행정보 */}
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">{t('common.bank_account_info')}</h2>
          <p className="text-sm text-slate-500 mb-5">{t('common.bank_account_desc')}</p>
          <div className="space-y-4">
            <label className="field-label">
              {t('common.bank_name_label')}
              <input
                className="input-base mt-2"
                value={form.bank_name}
                onChange={e => setForm({ ...form, bank_name: e.target.value })}
                placeholder={t('common.bank_name_placeholder')}
              />
            </label>
            <label className="field-label">
              {t('common.account_number_label')}
              <input
                className="input-base mt-2"
                value={form.account_number}
                onChange={e => setForm({ ...form, account_number: e.target.value })}
                placeholder={t('common.account_number_placeholder')}
              />
            </label>
            <label className="field-label">
              {t('common.account_holder_label')}
              <input
                className="input-base mt-2"
                value={form.account_holder}
                onChange={e => setForm({ ...form, account_holder: e.target.value })}
                placeholder={t('common.account_holder_placeholder')}
              />
            </label>
          </div>
        </div>

        {/* QR 미리보기 안내 */}
        {(form.bank_name || form.account_number) && (
          <div className="card bg-[#eef6ff] border border-[#d6e9ff]">
            <h3 className="text-sm font-semibold text-[#4f8fcb] mb-2">{t('common.qr_preview')}</h3>
            <pre className="text-xs text-[#5f88ae] whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-[#d6e9ff]">
              {form.receipt_header}
              {'\n'}{t('common.bank_name_label')} {form.bank_name}
              {'\n'}{t('common.account_number_label')} {form.account_number}
              {'\n'}{t('common.account_holder_label')} {form.account_holder}
              {'\n'}{t('common.qr_preview_amount_note')}
            </pre>
          </div>
        )}

        <button type="submit" disabled={loading} className="button-primary w-full sm:w-auto">
          {loading ? t('common.saving') : t('common.save_settings')}
        </button>
      </form>

      {/* 설정 테이블 생성 안내 */}
      <div className="card bg-[#f6faff] border border-[#d6e9ff]">
        <h3 className="text-sm font-semibold text-[#4f8fcb] mb-2">{t('common.settings_table_guide')}</h3>
        <p className="text-xs text-[#5f88ae] mb-3">{t('common.settings_table_desc')}</p>
        <pre className="text-xs bg-white rounded-lg p-3 border border-[#d6e9ff] overflow-x-auto text-slate-700 font-mono">
{`CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT 'default',
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  receipt_header text NOT NULL DEFAULT '${t('common.pos_restaurant')}',
  staff_header_text text NOT NULL DEFAULT '${t('common.company_icon_pos')}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

-- 기존 테이블에 컬럼만 추가할 경우:
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS staff_header_text
  text NOT NULL DEFAULT '${t('common.company_icon_pos')}';`}
        </pre>
      </div>
    </div>
  );
}