import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // settings 테이블 현재 컬럼 확인
  const { data: existing, error: readErr } = await admin
    .from('settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  const hasColumn = existing !== null && 'staff_header_text' in (existing || {});
  const columns = existing ? Object.keys(existing) : [];

  // staff_header_text 컬럼이 없으면 upsert로 강제 추가 시도
  // (PostgREST는 DDL 불가, 컬럼이 없으면 아래 upsert가 실패함)
  let addResult: string | null = null;
  if (!hasColumn) {
    const { error: upsertErr } = await admin.from('settings').upsert({
      id: 'default',
      staff_header_text: '회사아이콘 pos 시스템',
    });
    addResult = upsertErr ? `컬럼 추가 실패: ${upsertErr.message}` : '컬럼 추가 성공 또는 이미 존재';
  }

  return NextResponse.json({
    hasStaffHeaderColumn: hasColumn,
    columns,
    readError: readErr?.message ?? null,
    addResult,
    sql: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS staff_header_text text NOT NULL DEFAULT '회사아이콘 pos 시스템';`,
  });
}
