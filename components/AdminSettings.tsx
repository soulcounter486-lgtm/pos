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

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  async function fetchSettings() {
    setLoading(true);
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
      }
    } catch (e) {
      console.error('설정 불러오기 오류:', e);
      setMessage('설정을 불러오지 못했습니다. settings 테이블이 생성되었는지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('settings').upsert({
        id: 'default',
        ...form,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await fetchSettings();
      setMessage('저장되었습니다.');
    } catch (e) {
      console.error('설정 저장 오류:', e);
      setMessage('저장 실패. settings 테이블이 있는지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${message.includes('실패') || message.includes('못했') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
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

        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">직원 메인 헤더</h2>
          <p className="text-sm text-slate-500 mb-5">직원 메인페이지 상단에 표시될 문구를 설정합니다.</p>
          <label className="field-label">
            상단 문구
            <input
              className="input-base mt-2"
              value={form.staff_header_text}
              onChange={e => setForm({ ...form, staff_header_text: e.target.value })}
              placeholder="예: 회사아이콘 pos 시스템"
            />
          </label>
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
  ON CONFLICT (id) DO NOTHING;`}
        </pre>
      </div>
    </div>
  );
}
