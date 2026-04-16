'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Settings = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  receipt_header: string;
  staff_header_text: string;
};

export default function AdminSettings() {
  const [form, setForm] = useState<Settings>({
    bank_name: '',
    account_number: '',
    account_holder: '',
    receipt_header: 'POS 레스토랑',
    staff_header_text: '회사아이콘 pos 시스템',
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
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage(text);
    setMessageType(type);
  }

  async function checkColumnAndLoad() {
    setLoading(true);
    try {
      // 컬럼 존재 여부 확인 (migrate API)
      const res = await fetch('/api/migrate-settings');
      if (res.ok) {
        const info = await res.json();
        setHasStaffHeaderCol(info.hasStaffHeaderColumn);
      }
    } catch (e) {
      console.warn('마이그레이션 API 호출 실패:', e);
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
          receipt_header: data.receipt_header || 'POS 레스토랑',
          staff_header_text: data.staff_header_text || '회사아이콘 pos 시스템',
        });
        // 컬럼 존재 여부 재확인
        if (hasStaffHeaderCol === null) {
          setHasStaffHeaderCol('staff_header_text' in data);
        }
      }
    } catch (e) {
      console.error('설정 불러오기 오류:', e);
      showMsg('설정을 불러오지 못했습니다.', 'error');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { bank_name, account_number, account_holder, receipt_header, staff_header_text } = form;

      // staff_header_text 포함해서 우선 시도
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

      // 컬럼 없는 경우 (42703: column does not exist)
      const isColErr = (err: typeof error) =>
        !!err && (err.code === '42703' || /Could not find.*column|staff_header_text/i.test(err.message || ''));

      if (isColErr(error)) {
        // staff_header_text 없이 저장
        const basePayload = { id: 'default', bank_name, account_number, account_holder, receipt_header, updated_at: new Date().toISOString() };
        const { error: e2 } = await supabase.from('settings').upsert(basePayload);
        if (e2) throw e2;
        setHasStaffHeaderCol(false);
        showMsg('나머지 설정은 저장됐습니다. 직원 헤더를 저장하려면 아래 SQL을 실행해주세요.', 'error');
        setLoading(false);
        return;
      }

      if (error) throw error;

      setHasStaffHeaderCol(true);
      await fetchSettings();
      showMsg('저장되었습니다.');
    } catch (e: unknown) {
      console.error('설정 저장 오류:', e);
      const msg = e instanceof Error ? e.message : String(e);
      showMsg('저장 실패: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${messageType === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 영수증 헤더 */}
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">영수증 설정</h2>
          <p className="text-sm text-slate-500 mb-5">가영수증 상단에 표시될 상호명 및 안내문구를 설정합니다.</p>
          <label className="field-label">
            영수증 상단 텍스트 (상호명)
            <input
              className="input-base mt-2"
              value={form.receipt_header}
              onChange={e => setForm({ ...form, receipt_header: e.target.value })}
              placeholder="예: ☕ Pho Cha Restaurant"
            />
          </label>
        </div>

        {/* 직원 메인 헤더 */}
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">직원 메인 헤더</h2>
          <p className="text-sm text-slate-500 mb-5">직원 메인페이지 상단에 표시될 문구를 설정합니다.</p>
          <label className="field-label">
            상단 문구
            <input
              className="input-base mt-2"
              value={form.staff_header_text}
              onChange={e => setForm({ ...form, staff_header_text: e.target.value })}
              placeholder="예: 🏠 Pho Cha POS 시스템"
            />
          </label>
          {hasStaffHeaderCol === false && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 font-semibold mb-2">⚠️ DB 컬럼 추가 필요</p>
              <p className="text-xs text-red-600 mb-2">아래 SQL을 Supabase SQL Editor에서 실행하면 저장됩니다.</p>
              <pre className="text-xs bg-white rounded p-2 border border-red-200 text-slate-700 font-mono overflow-x-auto">
                {`ALTER TABLE settings\n  ADD COLUMN IF NOT EXISTS staff_header_text\n  text NOT NULL DEFAULT '회사아이콘 pos 시스템';`}
              </pre>
            </div>
          )}
          {hasStaffHeaderCol === true && (
            <p className="mt-2 text-xs text-green-600">✅ DB 컬럼 정상</p>
          )}
        </div>

        {/* 은행정보 */}
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">은행 계좌 정보</h2>
          <p className="text-sm text-slate-500 mb-5">계좌이체 결제 시 QR코드와 함께 표시될 은행정보입니다.</p>
          <div className="space-y-4">
            <label className="field-label">
              은행명
              <input
                className="input-base mt-2"
                value={form.bank_name}
                onChange={e => setForm({ ...form, bank_name: e.target.value })}
                placeholder="예: Vietcombank, Techcombank, BIDV..."
              />
            </label>
            <label className="field-label">
              계좌번호
              <input
                className="input-base mt-2"
                value={form.account_number}
                onChange={e => setForm({ ...form, account_number: e.target.value })}
                placeholder="예: 1234567890"
              />
            </label>
            <label className="field-label">
              예금주
              <input
                className="input-base mt-2"
                value={form.account_holder}
                onChange={e => setForm({ ...form, account_holder: e.target.value })}
                placeholder="예: 홍길동"
              />
            </label>
          </div>
        </div>

        {/* QR 미리보기 안내 */}
        {(form.bank_name || form.account_number) && (
          <div className="card bg-blue-50 border border-blue-100">
            <h3 className="text-sm font-semibold text-blue-700 mb-2">QR코드 인코딩 미리보기</h3>
            <pre className="text-xs text-blue-600 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-blue-100">
              {form.receipt_header}
              {'\n'}은행: {form.bank_name}
              {'\n'}계좌: {form.account_number}
              {'\n'}예금주: {form.account_holder}
              {'\n'}(결제 시 금액이 포함됩니다)
            </pre>
          </div>
        )}

        <button type="submit" disabled={loading} className="button-primary w-full sm:w-auto">
          {loading ? '저장 중...' : '설정 저장'}
        </button>
      </form>

      {/* 설정 테이블 생성 안내 */}
      <div className="card bg-amber-50 border border-amber-100">
        <h3 className="text-sm font-semibold text-amber-700 mb-2">⚠️ Supabase 설정 필요</h3>
        <p className="text-xs text-amber-600 mb-3">settings 테이블이 없으면 아래 SQL을 Supabase SQL Editor에서 실행해주세요.</p>
        <pre className="text-xs bg-white rounded-lg p-3 border border-amber-200 overflow-x-auto text-slate-700 font-mono">
{`CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT 'default',
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  receipt_header text NOT NULL DEFAULT 'POS 레스토랑',
  staff_header_text text NOT NULL DEFAULT '회사아이콘 pos 시스템',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

-- 기존 테이블에 컬럼만 추가할 경우:
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS staff_header_text
  text NOT NULL DEFAULT '회사아이콘 pos 시스템';`}
        </pre>
      </div>
    </div>
  );
}
