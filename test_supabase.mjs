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

console.log('Supabase 연결 테스트...\n');
console.log('URL:', supabaseUrl ? '있음' : '없음');
console.log('KEY:', supabaseAnonKey ? '있음' : '없음');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// orders 테이블 조회 테스트
console.log('\n1. orders 테이블 조회...');
const { data: orders, error: ordersErr } = await supabase.from('orders').select('*').limit(5);
console.log('주문 수:', orders?.length || 0);
if (ordersErr) console.error('에러:', ordersErr);

// order_items 테이블 조회 테스트
console.log('\n2. order_items 테이블 조회...');
const { data: items, error: itemsErr } = await supabase.from('order_items').select('*').limit(5);
console.log('주문아이템 수:', items?.length || 0);
if (itemsErr) console.error('에러:', itemsErr);

// 새 주문 생성 테스트
console.log('\n3. 새 주문 생성 테스트...');
const { data: newOrder, error: newOrderErr } = await supabase.from('orders').insert({
  table_id: 'test-order-id',
  total_amount: 10000,
  status: 'PENDING'
}).select().single();

console.log('생성 결과:', newOrder ? '성공' : '실패');
if (newOrderErr) console.error('에러:', newOrderErr);
if (newOrder) {
  console.log('주문ID:', newOrder.id);
  
  // 주문아이템 생성
  const { data: newItem, error: newItemErr } = await supabase.from('order_items').insert({
    order_id: newOrder.id,
    product_id: 'test-product-id',
    quantity: 1,
    price: 10000
  });
  console.log('주문아이템 생성:', newItem ? '성공' : '실패');
  if (newItemErr) console.error('에러:', newItemErr);
}

console.log('\n완료');
process.exit(0);