import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Check current columns of settings table
  const { data: existing, error: readErr } = await admin
    .from('settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  const hasColumn = existing !== null && 'staff_header_text' in (existing || {});
  const columns = existing ? Object.keys(existing) : [];

  // If staff_header_text column doesn't exist, try to force add via upsert
  // (PostgREST cannot do DDL, if column doesn't exist, the upsert below will fail)
  let addResult: string | null = null;
  if (!hasColumn) {
    const { error: upsertErr } = await admin.from('settings').upsert({
      id: 'default',
      staff_header_text: '회사아이콘 pos 시스템',
    });
    addResult = upsertErr ? `Column addition failed: ${upsertErr.message}` : 'Column addition successful or already exists';
  }

  return NextResponse.json({
    hasStaffHeaderColumn: hasColumn,
    columns,
    readError: readErr?.message ?? null,
    addResult,
    sql: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS staff_header_text text NOT NULL DEFAULT '회사아이콘 pos 시스템';`,
  });
}
