'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Product = { id: string; name: string; category: string; price: number; barcode?: string; stock: number; image_url?: string };
type CartItem = Product & { quantity: number };
type Table = { id: string; name: string; status: string };
type OrderData = { id: string; table_id: string; total_amount: number; status: string; created_at: string };
type OrderItemData = { id: string; order_id: string; product_id: string; quantity: number; price: number; status: string };

export default function StaffPos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<OrderData[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<OrderItemData[]>([]);
  const [currentView, setCurrentView] = useState<'orders' | 'menu'>('orders');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<OrderData[]>([]);
  const [isOrderComplete, setIsOrderComplete] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 뒤로가기 처리
  useEffect(() => {
    if (!selectedTable) {
      window.history.replaceState({ main: true }, '', window.location.href);
    }
    const onPop = () => {
      if (selectedTable) {
        setSelectedTable(null); setCurrentView('orders'); setPendingOrders([]); setShowPaymentModal(false);
      } else {
        window.history.pushState({ main: true }, '', window.location.href);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [selectedTable]);

  useEffect(() => { loadAllData(); }, []);
  useEffect(() => {
    if (isOrderComplete) { setIsOrderComplete(false); setSelectedTable(null); setMessage(null); }
  }, [isOrderComplete]);

  async function loadAllData() { await Promise.all([fetchProducts(), fetchTables(), fetchOrders()]); setDataLoaded(true); }
  async function fetchProducts() {
    setLoading(true);
    try { const s = getSupabase(); const { data, error } = await s.from('products').select('*').order('name'); if (error) throw error; setProducts(data || []); }
    catch (e) { setMessage('상품 목록을 불러오지 못했습니다.'); }
    setLoading(false);
  }
  async function fetchTables() {
    setLoadingTables(true);
    try { const s = getSupabase(); const { data, error } = await s.from('tables').select('*'); if (error) throw error; setTables(data || []); }
    catch (e) { console.error('Table error:', e); }
    setLoadingTables(false);
  }
  async function fetchOrders() {
    try {
      const s = getSupabase();
      const { data: orders } = await s.from('orders').select('*').order('created_at', { ascending: false });
      const { data: items } = await s.from('order_items').select('*');
      setAllOrders(orders || []); setAllOrderItems(items || []);
    } catch (e) { console.error('Orders error:', e); }
  }

  function navigateTo(view: 'orders' | 'menu') {
    setCurrentView(view);
    window.history.pushState({ ts: selectedTable, view }, '', `/staff?table=${selectedTable}&view=${view}`);
  }

  function selectTable(tableId: string) {
    const hasOrder = (tableOrderInfo[tableId]?.orders.length || 0) > 0;
    const view = hasOrder ? 'orders' : 'menu';
    window.history.pushState({ ts: tableId, view }, '', `/staff?table=${tableId}&view=${view}`);
    setSelectedTable(tableId); setCurrentView(view);
  }

  function goBack() {
    setSelectedTable(null); setCurrentView('orders'); setPendingOrders([]); setShowPaymentModal(false);
    window.history.replaceState({ main: true }, '', '/staff');
  }

  async function deleteAllOrdersForTable(tableId: string) {
    if (!confirm('테이블 ' + tableId + '의 모든 주문을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const s = getSupabase();
      const { data: orders } = await s.from('orders').select('id').eq('table_id', tableId);
      const ids = orders?.map((o: any) => o.id) || [];
      if (ids.length > 0) await s.from('order_items').delete().in('order_id', ids);
      const { error } = await s.from('orders').delete().eq('table_id', tableId);
      if (error) throw error; setMessage('테이블 ' + tableId + ' 주문이 삭제되었습니다.'); await fetchOrders();
    } catch (e) { setMessage('삭제 중 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  const tableOrderInfo: Record<string, { orders: OrderData[]; totalAmount: number }> = useMemo(() => {
    const info: Record<string, { orders: OrderData[]; totalAmount: number }> = {};
    allOrders.forEach(order => {
      const key = String(order.table_id);
      if (!info[key]) info[key] = { orders: [], totalAmount: 0 };
      info[key].orders.push(order); info[key].totalAmount += order.total_amount;
    });
    return info;
  }, [allOrders]);

  function addToCart(product: Product) {
    if (product.stock <= 0) { setMessage('재고가 부족합니다.'); return; }
    const ex = cart.find(i => i.id === product.id);
    if (ex) { if (ex.quantity < product.stock) setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)); else setMessage('재고가 부족합니다.'); }
    else setCart([...cart, { ...product, quantity: 1 }]);
  }
  function updateQuantity(productId: string, delta: number) {
    setCart(cart.map(i => {
      if (i.id === productId) { const n = i.quantity + delta; if (n > 0 && n <= i.stock) return { ...i, quantity: n }; }
      return i;
    }));
  }
  function removeFromCart(productId: string) { setCart(cart.filter(i => i.id !== productId)); }

  async function submitOrder() {
    if (cart.length === 0) return;
    const sub = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax = sub * 0.1; const total = sub + tax;
    setLoading(true);
    try {
      const s = getSupabase();
      const { data: od, error: oe } = await s.from('orders').insert({
        table_id: selectedTable, total_amount: total, status: 'pending', payment_method: 'card', include_tax: true, subtotal: sub, tax_amount: tax
      }).select().single();
      if (oe) throw oe;
      await s.from('order_items').insert(cart.map(i => ({ order_id: od.id, product_id: i.id, quantity: i.quantity, price: i.price, status: 'pending' })));
      setCart([]); setMessage('주문이 완료되었습니다!'); await fetchOrders(); navigateTo('orders');
    } catch (e) { setMessage('주문 처리 중 오류 발생'); }
    finally { setLoading(false); }
  }

  const cartTotal = useMemo(() => { const s = cart.reduce((a, i) => a + i.price * i.quantity, 0); return s + s * 0.1; }, [cart]);
  const categories = useMemo(() => ['all', ...new Set(products.map(p => p.category))], [products]);
  const filteredProducts = useMemo(() => {
    let f = products;
    if (selectedCategory !== 'all') f = f.filter(p => p.category === selectedCategory);
    if (searchTerm) f = f.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return f;
  }, [products, selectedCategory, searchTerm]);

  function issueReceipt(orders: OrderData[]) {
    if (orders.length === 0) return;
    const total = orders.reduce((s, o) => s + o.total_amount, 0);
    let r = '\n==============================\n         POS 가영수증\n==============================\n\n';
    r += '테이블: ' + selectedTable + '\n시간: ' + new Date().toLocaleString('ko-KR') + '\n주문: ' + orders.length + '건\n\n------------------------------\n';
    orders.forEach((o, i) => {
      r += '\n[주문 ' + (i + 1) + ']\n';
      allOrderItems.filter(x => x.order_id === o.id).forEach(item => {
        const p = products.find(pr => pr.id === item.product_id);
        r += '  ' + (p?.name || '상품') + ' x' + item.quantity + ' - ' + (item.price * item.quantity).toLocaleString() + ' VND\n';
      });
      r += '  소계: ' + o.total_amount.toLocaleString() + ' VND\n';
    });
    r += '\n------------------------------\n합계: ' + total.toLocaleString() + ' VND\n==============================\n';
    alert(r);
  }

  async function completePayment(method: string) {
    setShowPaymentModal(false);
    const orders = pendingOrders;
    const tableId = selectedTable;
    if (!tableId || orders.length === 0) return;
    const total = orders.reduce((s, o) => s + o.total_amount, 0);
    const orderIds = orders.map(o => o.id);

    setLoading(true);
    try {
      const supabase = getSupabase();

      // 1. 판매내역 저장 (실패해도 계속)
      try {
        const { data, error } = await supabase
          .from('sales')
          .insert({
            table_id: String(tableId),
            total_amount: total,
            payment_method: method,
            order_count: orders.length
          });
        console.log('Sales insert attempt completed');
      } catch (e) {
        console.error('Sales insert error:', e.message);
        setMessage('판매내역 저장 실패');
      }

      // 2. 주문 상태 업데이트 (문자열 비교로 통일)
      const { data: pendingOrders, error: pendingErr } = await supabase
        .from('orders')
        .select('id')
        .match({ table_id: String(tableId), status: 'pending' });
      if (pendingErr) throw pendingErr;

      if (pendingOrders && pendingOrders.length > 0) {
        const ids = pendingOrders.map(o => o.id);
        await supabase.from('orders').update({ status: 'completed', payment_method: method }).in('id', ids);
      }

      // 3. 주문 항목 완료
      if (orderIds.length > 0) {
        await supabase.from('order_items').update({ status: 'completed' }).in('order_id', orderIds);
      }

      // 4. 테이블 상태 초기화 (status 컬럼만 사용)
      const { data: tableRecord, error: tableFetchErr } = await supabase
        .from('tables')
        .select('status')
        .eq('id', String(tableId))
        .single();

      if (tableFetchErr) {
        console.error('테이블 조회 실패:', tableFetchErr);
        throw tableFetchErr;
      }

      // 현재 상태 확인
      const currentStatus: string | null = tableRecord ? tableRecord.status : null;
      if (currentStatus === null) {
        console.error('테이블 레코드가 없거나 status 컬럼이 없습니다.', tableRecord);
        throw new Error('테이블 레코드 또는 status 컬럼 없음');
      }

      console.log('테이블 전 상태:', currentStatus);

      // 상태 업데이트 to "available"
      const { data: tableUpdated, error: tableUpdateErr } = await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', String(tableId))
        .single();

      if (tableUpdateErr) {
        console.error('테이블 상태 업데이트 실패:', tableUpdateErr);
        throw tableUpdateErr;
      }

      console.log('테이블 후 상태:', (tableUpdated as any).status);

      // 상태 업데이트
      const updatePayload: any = {};
      updatePayload[statusColumn] = 'available';
      const { data: tableUpdated, error: tableUpdateErr } = await supabase
        .from('tables')
        .update(updatePayload)
        .eq('id', String(tableId))
        .single();

      if (tableUpdateErr) {
        console.error('테이블 상태 업데이트 실패:', tableUpdateErr);
        throw tableUpdateErr;
      }

      console.log('테이블 후 상태:', tableUpdated[statusColumn]);

      // 5. UI 업데이트
      setSelectedTable(null);
      setCurrentView('orders');
      setPendingOrders([]);
      setMessage('결제 완료!');

      await fetchOrders();
      await fetchTables();

      // 뒤로가기 방지용으로 URL 변경
      window.history.replaceState({ main: true }, '', '/staff');
    } catch (e) {
      console.error('결제 에러:', e);
      setSelectedTable(null);
      setCurrentView('orders');
      setPendingOrders([]);
      setMessage('결제 오류: ' + (e.message || '알수없음'));
      await fetchOrders();
      await fetchTables();
      window.history.replaceState({ main: true }, '', '/staff');
    }
    finally { setLoading(false); }
  }

  // ==================== 완료 화면 ====================
  if (isOrderComplete) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">&#10003;</span></div>
          <h2 className="text-2xl font-bold text-[#1F2937] mb-2">주문 완료</h2>
          <p className="text-[#6B7280]">테이블 선택 화면으로 돌아갑니다...</p>
        </div>
      </div>
    );
  }

  if (!dataLoaded || loadingTables) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#6B7280]">로딩 중...</p>
        </div>
      </div>
    );
  }

  // ==================== 테이블 선택 ====================
  if (!selectedTable) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <header className="bg-white border-b border-[#E5E7EB] px-6 lg:px-8 py-5 shadow-sm">
          <h1 className="text-xl font-bold text-[#111827]">직원 POS</h1>
          <p className="text-sm text-[#9CA3AF] mt-0.5">{allOrders.length}건 활성 주문</p>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {tables.sort((a, b) => Number(a.id) - Number(b.id)).map(table => {
              const ts = String(table.id);
              const oi = tableOrderInfo[ts];
              const hasOrder = (oi?.orders.length || 0) > 0;
              const totalOrders = oi?.orders.length || 0;
              const pending = oi?.orders.filter(o => o.status === 'pending').length || 0;
              const total = oi?.totalAmount || 0;
              return (
                <button key={table.id} onClick={() => selectTable(ts)}
                  className={'relative bg-white rounded-2xl p-4 lg:p-5 border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 text-left ' + (hasOrder ? 'border-red-200' : 'border-gray-100')}>
                  <div className={'absolute top-3 right-3 w-3 h-3 rounded-full ' + (hasOrder ? 'bg-red-400' : 'bg-green-400')}></div>
                  <div className="text-base lg:text-lg font-medium mb-2 text-[#111827]">Table {table.id}</div>
                  <div className={'text-xs lg:text-sm font-medium mb-2 lg:mb-3 ' + (hasOrder ? 'text-red-500' : 'text-green-500')}>{hasOrder ? '사용 중' : '사용 가능'}</div>
                  {total > 0 && (<div className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 rounded-lg px-2 lg:px-3 py-1.5 lg:py-2">{total.toLocaleString()} VND</div>)}
                  {totalOrders > 0 && (<div className="mt-2 lg:mt-3 flex gap-2"><span className="text-[10px] lg:text-xs text-gray-400">{totalOrders}건</span>{pending > 0 && <span className="text-[10px] lg:text-xs text-amber-500">{pending}건 대기</span>}</div>)}
                </button>
              );
            })}
          </div>
        </main>
        {message && (<div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1F2937] text-white px-5 py-3 rounded-full shadow-lg text-sm z-50">{message}</div>)}
      </div>
    );
  }

  // ==================== 주문내역 ====================
  if (currentView === 'orders') {
    const tableOrders = allOrders.filter(o => String(o.table_id) === selectedTable);
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <header className="bg-white border-b border-[#E5E7EB] px-4 lg:px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={goBack} className="text-gray-400 hover:text-[#111827] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-base lg:text-lg font-bold text-[#111827]">Table {selectedTable}</h1>
                <p className="text-[10px] lg:text-xs text-gray-400">주문내역 {tableOrders.length}건</p>
              </div>
            </div>
            <button onClick={() => deleteAllOrdersForTable(selectedTable!)} disabled={tableOrders.length === 0}
              className="text-xs lg:text-sm text-red-400 hover:text-red-500 disabled:opacity-40 font-medium px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg hover:bg-red-50 transition-colors">전체삭제</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2 lg:space-y-3 max-w-3xl mx-auto w-full">
          {tableOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <span className="text-5xl mb-3">&#128203;</span>
              <p className="text-sm">주문 내역이 없습니다</p>
            </div>
          ) : (
            tableOrders.map(order => {
              const items = allOrderItems.filter(i => i.order_id === order.id);
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 lg:px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={'text-xs px-2 lg:px-2.5 py-0.5 lg:py-1 rounded-full font-medium ' + (order.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600')}>
                        {order.status === 'pending' ? '대기' : '완료'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#111827]">{order.total_amount.toLocaleString()} VND</div>
                      <div className="text-[10px] text-gray-400">{new Date(order.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  <div className="px-4 lg:px-5 pb-3 space-y-1 lg:space-y-1.5">
                    {items.map(item => {
                      const product = products.find(p => p.id === item.product_id);
                      return (
                        <div key={item.id} className="flex items-center gap-2 lg:gap-3 py-1 lg:py-1.5">
                          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] text-gray-300">-</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] lg:text-xs font-medium text-[#374151] truncate">{product?.name || 'Unknown'}</p>
                            <p className="text-[9px] lg:text-[10px] text-gray-400">{item.price.toLocaleString()} VND</p>
                          </div>
                          <span className="text-xs lg:text-sm font-semibold text-[#111827]">x{item.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </main>

        <div className="bg-white border-t border-[#E5E7EB] px-3 lg:px-4 py-2.5 lg:py-3 flex gap-2 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)]">
          <button onClick={() => issueReceipt(tableOrders)} className="flex-1 bg-gray-50 hover:bg-gray-100 text-[#374151] py-2.5 lg:py-3.5 rounded-xl text-[11px] lg:text-sm font-semibold transition-colors">영수증</button>
          <button onClick={() => { setPendingOrders(tableOrders); setShowPaymentModal(true); }} disabled={tableOrders.length === 0}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2.5 lg:py-3.5 rounded-xl text-[11px] lg:text-sm font-semibold transition-colors">결제</button>
        </div>

        <button onClick={() => navigateTo('menu')}
          className="fixed bottom-20 lg:bottom-24 right-4 lg:right-6 w-12 h-12 lg:w-14 lg:h-14 bg-[#1F2937] hover:bg-[#111827] text-white text-xl lg:text-2xl rounded-full shadow-xl hover:scale-105 transition-all flex items-center justify-center z-40">+</button>

        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-[#111827]">결제 수단</h3>
                <p className="text-sm text-gray-400">Table {selectedTable} &#183; {pendingOrders.reduce((s, o) => s + o.total_amount, 0).toLocaleString()} VND</p>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { key: 'cash', icon: '\uD83D\uDCB5', name: '현금', sub: 'Cash' },
                  { key: 'card', icon: '\uD83D\uDCB3', name: '카드', sub: 'Card' },
                  { key: 'transfer', icon: '\uD83C\uDFE6', name: '이체', sub: 'Transfer' },
                ].map(m => (
                  <button key={m.key} onClick={() => completePayment(m.key)}
                    className="w-full flex items-center gap-4 bg-gray-50 hover:bg-gray-100 p-4 rounded-xl transition-colors text-left">
                    <span className="text-2xl">{m.icon}</span>
                    <div><p className="font-semibold text-[#111827]">{m.name}</p><p className="text-xs text-gray-400">{m.sub}</p></div>
                  </button>
                ))}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button onClick={() => { setShowPaymentModal(false); setPendingOrders([]); }}
                  className="w-full text-gray-400 hover:text-[#374151] py-2 text-sm font-medium">취소</button>
              </div>
            </div>
          </div>
        )}

        {message && (<div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1F2937] text-white px-5 py-3 rounded-full shadow-lg text-sm z-40">{message}</div>)}
      </div>
    );
  }

  // ==================== 메뉴 주문 (반응형: PC 좌우분할 / 모바일 단일) ====================
  return (
    <div className="min-h-screen bg-[#F8F9FA] lg:flex lg:flex-row">
      {/* ===== 왼쪽: 상품 영역 ===== */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">
        <header className="bg-white border-b border-[#E5E7EB] px-3 lg:px-4 py-2.5 lg:py-3 shadow-sm">
          <div className="flex items-center justify-between mb-2 lg:mb-3">
            <div className="flex items-center gap-2 lg:gap-3">
              <button onClick={goBack} className="text-gray-400 hover:text-[#111827]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h1 className="text-base lg:text-lg font-bold text-[#111827]">Table {selectedTable}</h1>
            </div>
            {/* 모바일 전용 주문내역 버튼 */}
            <button onClick={() => navigateTo('orders')} className="text-xs lg:text-sm text-blue-500 font-medium px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg hover:bg-blue-50 transition-colors lg:hidden">
              주문내역
            </button>
          </div>
          <div className="mb-2 lg:mb-3">
            <input type="text" placeholder="검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-3 lg:px-4 py-2 lg:py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-[#374151] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
          </div>
          <div className="flex gap-1 lg:gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={'px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-medium whitespace-nowrap transition-all ' + (selectedCategory === cat ? 'bg-[#1F2937] text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50')}>
                {cat === 'all' ? '전체' : cat}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">로딩 중...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 lg:gap-3">
              {filteredProducts.map(product => (
                <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0}
                  className={
                    'bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden text-left ' +
                    (product.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5')
                  }>
                  <div className="w-full aspect-square bg-gray-50 flex items-center justify-center p-2 lg:p-3">
                    {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-300">-</span>}
                  </div>
                  <div className="p-2 lg:p-3">
                    <p className="text-[11px] lg:text-sm font-semibold text-[#111827] leading-tight line-clamp-2 mb-0.5 lg:mb-1 min-h-[1.8rem] lg:min-h-[2.5rem]">{product.name}</p>
                    <p className="text-[9px] lg:text-[10px] text-gray-400 mb-1 lg:mb-2">{product.category}</p>
                    <p className="text-[11px] lg:text-sm font-bold text-blue-500">{product.price.toLocaleString()} VND</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 오른쪽: 장바구니 (모바일 고정 하단 / PC sticky 사이드바) ===== */}
      {/* 모바일용 하단 바 */}
      <div className="bg-white border-t border-gray-100 px-3 lg:hidden lg:px-4 py-2.5 lg:py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.06)] z-30 lg:z-0">
        {cart.length > 0 ? (
          <div className="space-y-1.5 mb-2 max-h-24 overflow-y-auto">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs font-medium text-[#374151] truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400">{item.price.toLocaleString()} VND</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center font-bold text-gray-500 text-xs">-</button>
                  <span className="w-5 text-center text-xs font-bold text-[#111827]">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center font-bold text-gray-500 text-xs">+</button>
                  <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 bg-red-50 hover:bg-red-100 rounded flex items-center justify-center text-red-400 text-xs ml-0.5">&#x2715;</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-gray-400 py-1.5">상품을 선택하세요</p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <p className="text-base font-bold text-[#111827]">{cartTotal.toLocaleString()} <span className="text-xs font-normal text-gray-400">VND</span></p>
            <p className="text-[10px] text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)}개</p>
          </div>
          <button onClick={submitOrder} disabled={loading || cart.length === 0}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20">
            {loading ? '처리중...' : '주문하기'}
          </button>
        </div>
      </div>

      {/* PC용 sticky 사이드바 */}
      <div className="hidden lg:block lg:w-80 xl:w-96">
        <div className="sticky top-0 h-screen bg-white border-l border-gray-100 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111827]">장바구니</h2>
            <button onClick={() => navigateTo('orders')} className="text-xs text-blue-500 hover:text-blue-600 font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
              주문내역
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
            {cart.length === 0 && (<p className="text-center text-xs text-gray-400 py-8">상품을 선택하세요</p>)}
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs font-medium text-[#374151] truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400">{item.price.toLocaleString()} VND</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">-</button>
                  <span className="w-5 text-center text-xs font-bold text-[#111827]">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">+</button>
                  <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 bg-red-50 hover:bg-red-100 rounded flex items-center justify-center text-red-400 text-xs ml-0.5">&#x2715;</button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-lg font-bold text-[#111827]">{cartTotal.toLocaleString()} <span className="text-xs font-normal text-gray-400">VND</span></p>
                <p className="text-[10px] text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)}개</p>
              </div>
              <button onClick={submitOrder} disabled={loading || cart.length === 0}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20">
                {loading ? '처리중...' : '주문하기'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {message && (<div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1F2937] text-white px-5 py-3 rounded-full shadow-lg text-sm z-50">{message}</div>)}
    </div>
  );
}
