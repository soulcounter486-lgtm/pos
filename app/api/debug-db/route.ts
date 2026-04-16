import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars', url: !!url, serviceKey: !!serviceKey });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey!, { auth: { persistSession: false } });

  const [
    { data: ordersAdmin, error: ordersAdminErr },
    { data: ordersAnon, error: ordersAnonErr },
    { data: itemsAdmin, error: itemsAdminErr },
    { data: itemsAnon, error: itemsAnonErr },
    { data: tables, error: tablesErr },
  ] = await Promise.all([
    admin.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
    anon.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
    admin.from('order_items').select('*').limit(5),
    anon.from('order_items').select('*').limit(5),
    admin.from('tables').select('*').limit(20),
  ]);

  return NextResponse.json({
    ordersAdmin: { count: ordersAdmin?.length, sample: ordersAdmin?.[0], columns: ordersAdmin?.[0] ? Object.keys(ordersAdmin[0]) : [], error: ordersAdminErr?.message },
    ordersAnon: { count: ordersAnon?.length, sample: ordersAnon?.[0], error: ordersAnonErr?.message },
    itemsAdmin: { count: itemsAdmin?.length, sample: itemsAdmin?.[0], columns: itemsAdmin?.[0] ? Object.keys(itemsAdmin[0]) : [], error: itemsAdminErr?.message },
    itemsAnon: { count: itemsAnon?.length, sample: itemsAnon?.[0], error: itemsAnonErr?.message },
    tables: { data: tables, error: tablesErr?.message },
  }, { headers: { 'Content-Type': 'application/json' } });
}
