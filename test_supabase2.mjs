import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = fs.readFileSync('D:\\pos\\.env.local', 'utf-8')
  .split('\n')
  .find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL='))
  ?.split('=')[1];

const supabaseAnonKey = fs.readFileSync('D:\\pos\\.env.local', 'utf-8')
  .split('\n')
  .find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY='))
  ?.split('=')[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 기존 주문 조회
console.log('기존 주문 조회...');
const { data: orders, error: ordersErr } = await supabase.from('orders').select('*').limit(3);
console.log('주문:', JSON.stringify(orders, null, 2));
console.log('에러:', ordersErr);

// 기존 주문아이템 조회
console.log('\n기존 주문아이템 조회...');
const { data: items, error: itemsErr } = await supabase.from('order_items').select('*').limit(3);
console.log('주문아이템:', JSON.stringify(items, null, 2));
console.log('에러:', itemsErr);

process.exit(0);