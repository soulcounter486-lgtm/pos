'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Product = { id: string; name: string; category: string; price: number; barcode?: string; stock: number; image_url?: string; tax_rate?: number };
type CartItem = Product & { quantity: number };
type Table = { id: string; name: string; status: string };
type OrderData = { id: string; table_id: string; total: number; status: string; created_at: string; total_amount?: number; tax_amount?: number };
type OrderItemData = { id: string; order_id: string; product_id: string; quantity: number; price: number; status: string };
type EditingOrderItem = { itemId: string; newQuantity: number };

export default function StaffPos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<OrderData[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<OrderItemData[]>([]);
  const [editingOrderItem, setEditingOrderItem] = useState<EditingOrderItem | null>(null);
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
  
  // 디버그: tables 로드 후 로그
  useEffect(() => {
    console.log(' tables 로드됨:', tables);
  }, [tables]);
  useEffect(() => {
    if (isOrderComplete) { setIsOrderComplete(false); setSelectedTable(null); setMessage(null); }
  }, [isOrderComplete]);

  // 메시지 자동 삭제 타이머
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000); // 3초 후 메시지 자동 삭제
      return () => clearTimeout(timer);
    }
  }, [message]);

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
    console.log('=== fetchOrders 시작 ===');
    try {
      const s = getSupabase();
      console.log('Supabase 클라이언트 생성됨');
      
      const { data: orders, error: ordersError } = await s.from('orders').select('*').order('created_at', { ascending: false });
      console.log('orders 조회 결과:', { orders, ordersError });
      
      // order_items 조회
      const { data: items, error: itemsError } = await s.from('order_items').select('*');
      console.log('order_items 조회 결과:', { items, itemsError });
      
      if (ordersError) {
        console.error('orders 조회 오류:', ordersError);
      }
      if (itemsError) {
        console.error('order_items 조회 오류:', itemsError);
      }
      
      // orders 테이블의 데이터를 allOrders에 저장
      setAllOrders(orders || []); 
      setAllOrderItems(items || []);
      
      console.log('데이터 상태 업데이트 완료:', { 
        ordersCount: orders?.length || 0, 
        itemsCount: items?.length || 0,
        sampleOrders: orders?.slice(0, 3),
        sampleItems: items?.slice(0, 3)
      });
    } catch (e) { 
      console.error('Orders error:', e); 
    } finally {
      console.log('=== fetchOrders 종료 ===');
    }
  }

  function startEditingOrderItem(itemId: string, currentQuantity: number) {
    setEditingOrderItem({ itemId, newQuantity: currentQuantity });
  }

  async function saveOrderItemQuantity(itemId: string, orderItemId: string, currentQuantity: number, newQuantity: number) {
    console.log('=== saveOrderItemQuantity 시작 ===');
    console.log('파라미터:', { itemId, orderItemId, currentQuantity, newQuantity });
    
    if (newQuantity <= 0) {
      setMessage('수량은 1 이상이어야 합니다.');
      return;
    }

    const orderItem = allOrderItems.find(i => i.id === orderItemId);
    if (!orderItem) {
      console.error('주문 항목을 찾을 수 없음:', orderItemId);
      setMessage('주문 항목을 찾을 수 없습니다.');
      return;
    }
    console.log('주문 항목 찾음:', orderItem);

    const product = products.find(p => p.id === orderItem.product_id);
    if (!product) {
      console.error('상품을 찾을 수 없음:', orderItem.product_id);
      setMessage('상품을 찾을 수 없습니다.');
      return;
    }
    console.log('상품 찾음:', product);

    // 수량 변경량 계산
    const quantityChange = newQuantity - currentQuantity;
    
    // 재고 확인 (수량 증가 시에만)
    if (quantityChange > 0 && product.stock < quantityChange) {
      setMessage('재고가 부족합니다.');
      return;
    }

    const s = getSupabase();
    console.log('Supabase 클라이언트 생성됨');
    
    try {
      if (newQuantity === 0) {
        // 수량이 0이면 항목 삭제
        console.log('항목 삭제 시작');
        const { error } = await s.from('order_items').delete().eq('id', orderItemId);
        if (error) {
          console.error('주문 항목 삭제 실패:', error);
          setMessage('주문 항목 삭제 실패: ' + error.message);
          return;
        }
        console.log('항목 삭제 성공');
        setMessage('주문 항목이 삭제되었습니다.');
      } else {
        // 기존 항목의 수량과 가격 업데이트 (단가와 총액 모두 업데이트)
        const unitPrice = product.price; // 단가
        const newPrice = unitPrice * newQuantity; // 총액 = 단가 × 수량
        console.log('수량 업데이트 시작:', {
          orderItemId,
          currentQuantity,
          newQuantity,
          unitPrice,
          newPrice,
          order_id: orderItem.order_id
        });
        
        // 1. order_items 업데이트 (unit_price와 price 모두 업데이트)
        console.log('order_items 업데이트 시도...');
        const { error: updateError, data: updateData } = await s.from('order_items').update({ 
          quantity: newQuantity,
          unit_price: unitPrice,  // 단가 업데이트
          price: newPrice         // 총액 업데이트
        }).eq('id', orderItemId);
        
        if (updateError) {
          console.error('order_items 업데이트 실패:', updateError);
          setMessage('수량 업데이트 실패: ' + updateError.message);
          return;
        }
        
        console.log('order_items 업데이트 성공:', updateData);
        
        // 2. 해당 주문의 모든 항목 가격 합계 계산
        console.log('주문 총액 계산 시작, order_id:', orderItem.order_id);
        const { data: items, error: itemsError } = await s.from('order_items').select('price').eq('order_id', orderItem.order_id);
        
        if (itemsError) {
          console.error('항목 조회 실패:', itemsError);
          // 계속 진행
        } else {
          console.log('항목 조회 결과:', items);
        }
        
        const totalAmount = items?.reduce((sum, item) => sum + item.price, 0) || 0;
        console.log('계산된 총액:', totalAmount);
        
        // 3. 주문 총액 업데이트 (created_at도 업데이트하여 최신순 정렬)
        console.log('orders 업데이트 시도...');
        const { error: orderUpdateError, data: orderUpdateData } = await s.from('orders').update({ 
          created_at: new Date().toISOString(), // 최신순 정렬을 위해 시간 업데이트
          total: totalAmount,
          total_amount: totalAmount 
        }).eq('id', orderItem.order_id);
        
        if (orderUpdateError) {
          console.error('orders 업데이트 실패:', orderUpdateError);
          setMessage('주문 업데이트 실패: ' + orderUpdateError.message);
          // 계속 진행
        } else {
          console.log('orders 업데이트 성공:', orderUpdateData);
        }
        
        setMessage('수량과 금액이 업데이트되었습니다.');
      }
      
      // 4. 데이터 새로고침
      console.log('데이터 새로고침 시작');
      await fetchOrders();
      await fetchProducts();
      console.log('데이터 새로고침 완료');
      
    } catch (error) {
      console.error('수량 업데이트 중 예외 발생:', error);
      setMessage('수량 업데이트 중 오류가 발생했습니다.');
    } finally {
      console.log('=== saveOrderItemQuantity 종료 ===');
      setEditingOrderItem(null);
    }
  }

  function cancelEditingOrderItem() {
    setEditingOrderItem(null);
  }

  async function updateOrderItemQuantity(orderId: string, orderItemId: string, currentQuantity: number, delta: number) {
    const newQuantity = currentQuantity + delta;
    if (newQuantity <= 0) {
      setMessage('수량은 1 이상이어야 합니다.');
      return;
    }
    await saveOrderItemQuantity(orderItemId, orderItemId, currentQuantity, newQuantity);
  }

  function navigateTo(view: 'orders' | 'menu') {
    setCurrentView(view);
    window.history.pushState({ ts: selectedTable, view }, '', `/staff?table=${selectedTable}&view=${view}`);
  }

  function selectTable(tableId: string) {
    console.log('=== selectTable 시작 ===');
    console.log('선택된 테이블:', tableId, typeof tableId);
    console.log('allOrders table_id 샘플:', allOrders.slice(0,3).map(o => ({ id: o.id, table_id: o.table_id, type: typeof o.table_id })));
    console.log('tables 샘플:', tables.slice(0,3));
    
    // 테이블에 어떤 상태의 주문이든 있는지 확인 (pending, completed 모두 포함)
    const tableOrders = allOrders.filter(order => String(order.table_id) === String(tableId));
    console.log('필터링된 주문:', tableOrders);
    
    const hasOrder = tableOrders.length > 0;
    const view = hasOrder ? 'orders' : 'menu';
    console.log('hasOrder:', hasOrder, 'view:', view);
    
    window.history.pushState({ ts: tableId, view }, '', `/staff?table=${tableId}&view=${view}`);
    setSelectedTable(String(tableId)); setCurrentView(view);
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
  allOrders
    .filter(order => order.status === 'pending')
    .forEach(order => {
      const key = String(order.table_id);
      if (!info[key]) info[key] = { orders: [], totalAmount: 0 };
      info[key].orders.push(order);
      // Use total_amount if available, otherwise fall back to total
      const orderTotal = order.total_amount !== undefined ? order.total_amount : order.total;
      info[key].totalAmount += orderTotal;
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

  function startEditingQuantity(productId: string, currentQuantity: number) {
    setEditingQuantityId(productId);
    setQuantityInput(currentQuantity.toString());
  }

  function saveQuantity(productId: string) {
    const newQuantity = parseInt(quantityInput);
    if (isNaN(newQuantity) || newQuantity < 1) {
      setMessage('유효한 수량을 입력해주세요.');
      return;
    }
    
    setCart(cart.map(i => {
      if (i.id === productId) {
        if (newQuantity > i.stock) {
          setMessage('재고가 부족합니다.');
          return i;
        }
        return { ...i, quantity: newQuantity };
      }
      return i;
    }));
    
    setEditingQuantityId(null);
    setQuantityInput('');
  }

  function cancelEditing() {
    setEditingQuantityId(null);
    setQuantityInput('');
  }
  function removeFromCart(productId: string) { setCart(cart.filter(i => i.id !== productId)); }

  async function submitOrder() {
    // Ensure a table is selected before attempting to create an order.
    if (!selectedTable) {
      setMessage('테이블을 선택하세요');
      return;
    }
    if (cart.length === 0) return;
    const sub = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    
    // Calculate tax based on product tax rates (use category default if product doesn't have tax_rate)
    const tax = cart.reduce((totalTax, item) => {
      const itemSubtotal = item.price * item.quantity;
      // Use product tax_rate if available, otherwise default to 10%
      const taxRate = item.tax_rate || 0.1;
      return totalTax + (itemSubtotal * taxRate);
    }, 0);
    
    const total = sub + tax;
    setLoading(true);
    try {
      const s = getSupabase();
       // Insert a new order with actual database column names
       const { data: od, error: oe } = await s.from('orders').insert({
         table_id: selectedTable,
         total_amount: total,  // actual column name is total_amount
         status: 'pending',
         payment_method: 'card',
         subtotal: sub,
         tax_amount: tax,      // actual column name is tax_amount
         include_tax: true     // actual column in database
       }).select().single();
      if (oe) throw oe;
       // Insert each cart item as an order_item.
       // 데이터베이스에는 unit_price와 price 컬럼이 모두 있음
       await s.from('order_items').insert(
         cart.map(i => ({
           order_id: od.id,
           product_id: i.id,
           quantity: i.quantity,
           unit_price: i.price,  // 단가
           price: i.price * i.quantity,  // 총액 = 단가 × 수량
         }))
       );
       setCart([]); 
       setMessage('주문이 완료되었습니다!'); 
       await fetchOrders(); // 데이터가 완전히 로드될 때까지 기다림
       navigateTo('orders'); // 데이터 로드 완료 후 화면 이동
    } catch (e) {
      // Log the full error for debugging and surface a more informative message to the user.
      console.error('주문 처리 중 오류 발생:', e);
      // Attempt to extract a readable message from the error object.
      let errMsg = '';
      if (e instanceof Error) {
        errMsg = e.message;
      } else if (typeof e === 'object' && e !== null && 'message' in e) {
        // @ts-ignore – dynamic property access
        errMsg = e.message;
      } else {
        errMsg = JSON.stringify(e);
      }
      setMessage('주문 처리 중 오류 발생: ' + errMsg);
    }
    finally { setLoading(false); }
  }

  const cartTotal = useMemo(() => {
    const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
    const tax = cart.reduce((totalTax, item) => {
      const itemSubtotal = item.price * item.quantity;
      const taxRate = item.tax_rate || 0.1;
      return totalTax + (itemSubtotal * taxRate);
    }, 0);
    return subtotal + tax;
  }, [cart]);
  const categories = useMemo(() => ['all', ...new Set(products.map(p => p.category))], [products]);
  const filteredProducts = useMemo(() => {
    let f = products;
    if (selectedCategory !== 'all') f = f.filter(p => p.category === selectedCategory);
    if (searchTerm) f = f.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return f;
  }, [products, selectedCategory, searchTerm]);

  function issueReceipt(orders: OrderData[]) {
    if (orders.length === 0) return;
    const total = orders.reduce((s, o) => {
      // Use total_amount if available, otherwise fall back to total
      return s + (o.total_amount !== undefined ? o.total_amount : o.total);
    }, 0);
    let r = '\n==============================\n         POS 가영수증\n==============================\n\n';
    r += '테이블: ' + selectedTable + '\n시간: ' + new Date().toLocaleString('ko-KR') + '\n주문: ' + orders.length + '건\n\n------------------------------\n';
    orders.forEach((o, i) => {
      r += '\n[주문 ' + (i + 1) + ']\n';
      allOrderItems.filter(x => x.order_id === o.id).forEach(item => {
        const p = products.find(pr => pr.id === item.product_id);
        r += '  ' + (p?.name || '상품') + ' x' + item.quantity + ' - ' + (item.price * item.quantity).toLocaleString() + ' VND\n';
      });
      const orderTotal = o.total_amount !== undefined ? o.total_amount : o.total;
      r += '  소계: ' + orderTotal.toLocaleString() + ' VND\n';
    });
    r += '\n------------------------------\n합계: ' + total.toLocaleString() + ' VND\n==============================\n';
    alert(r);
  }

  async function completePayment(method: string) {
    setShowPaymentModal(false);
    const orders = pendingOrders;
    const tableId = selectedTable;
    if (!tableId || orders.length === 0) return;
    const total = orders.reduce((s, o) => {
      // Use total_amount if available, otherwise fall back to total
      return s + (o.total_amount !== undefined ? o.total_amount : o.total);
    }, 0);
    const orderIds = orders.map(o => o.id);

    setLoading(true);
    try {
      const supabase = getSupabase();

      // 1. 판매내역 저장 (실패해도 계속)
      try {
        // Insert a sales record. The schema defines the column name as `total_amount`.
        // Previously the code attempted to insert a non‑existent `total` column, which caused
        // a runtime error during payment processing. We now map the calculated total to the
        // correct column name.
        const { data, error } = await supabase
          .from('sales')
          .insert({
            table_id: String(tableId),
            total_amount: total,
            payment_method: method,
            order_count: orders.length
          });
        console.log('Sales insert attempt completed');
      } catch (e: any) { // Cast 'e' to 'any' to resolve type error
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

      // 4. 테이블 상태는 변경하지 않음 - 테이블 상태는 테이블 페이지에서만 관리
      console.log('결제 완료. 테이블 상태는 변경하지 않습니다.');

      // 5. UI 업데이트 - 테이블 선택 화면으로 돌아감
      setCurrentView('orders');
      setPendingOrders([]);
      setSelectedTable(null);
      setMessage('결제 완료!');
      
      await fetchOrders();
    } catch (e: any) {
      console.error('결제 에러:', e);
      setCurrentView('orders');
      setPendingOrders([]);
      setSelectedTable(null);
      setMessage('결제 오류: ' + (e.message || '알수없음'));
      await fetchOrders();
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
            {tables.sort((a, b) => {
              const aNum = Number(a.name.replace('Table ', ''));
              const bNum = Number(b.name.replace('Table ', ''));
              return aNum - bNum;
            }).map(table => {
              const ts = table.name.replace('Table ', '');
              // 테이블의 모든 주문 가져오기 (pending, completed 모두 포함)
              const tableOrders = allOrders.filter(order => String(order.table_id) === String(ts));
              const hasOrder = tableOrders.length > 0;
              const totalOrders = tableOrders.length;
              const pending = tableOrders.filter(o => o.status === 'pending').length;
              const total = tableOrders.reduce((sum, order) => {
                const orderTotal = order.total_amount !== undefined ? order.total_amount : order.total;
                return sum + orderTotal;
              }, 0);
              return (
                <button key={table.id} onClick={() => selectTable(ts)}
                  className={'relative bg-white rounded-2xl p-4 lg:p-5 border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 text-left ' + (hasOrder ? 'border-red-200' : 'border-gray-100')}>
                  <div className={'absolute top-3 right-3 w-3 h-3 rounded-full ' + (hasOrder ? 'bg-red-400' : 'bg-green-400')}></div>
                  <div className="text-base lg:text-lg font-medium mb-2 text-[#111827]">Table {table.name}</div>
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
    const tableOrders = allOrders.filter(o => String(o.table_id) === String(selectedTable));
    console.log('주문내역 화면 - selectedTable:', selectedTable, 'tableOrders:', tableOrders);
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
                      <div className="text-sm font-bold text-[#111827]">
                        {(order.total_amount !== undefined ? order.total_amount : order.total).toLocaleString()} VND
                      </div>
                      <div className="text-[10px] text-gray-400">{new Date(order.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  <div className="px-4 lg:px-5 pb-3 space-y-1 lg:space-y-1.5">
                    {items.map(item => {
                      const product = products.find(p => p.id === item.product_id);
                      const isEditing = editingOrderItem?.itemId === item.id;
                      return (
                        <div key={item.id} className="flex items-center gap-2 lg:gap-3 py-1 lg:py-1.5">
                          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] text-gray-300">-</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] lg:text-xs font-medium text-[#374151] truncate">{product?.name || 'Unknown'}</p>
                            <p className="text-[9px] lg:text-[10px] text-gray-400">{item.price.toLocaleString()} VND</p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => updateOrderItemQuantity(order.id, item.id, item.quantity, -1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center font-bold text-gray-500 text-xs">-</button>
                            <button onClick={() => startEditingOrderItem(item.id, item.quantity)} className="w-8 h-6 bg-gray-50 hover:bg-gray-100 rounded flex items-center justify-center font-bold text-[#111827] text-xs">
                              {item.quantity}
                            </button>
                            <button onClick={() => updateOrderItemQuantity(order.id, item.id, item.quantity, 1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center font-bold text-gray-500 text-xs">+</button>
                          </div>
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
                <p className="text-sm text-gray-400">Table {selectedTable} &#183; {pendingOrders.reduce((s, o) => {
                  return s + (o.total_amount !== undefined ? o.total_amount : o.total);
                }, 0).toLocaleString()} VND</p>
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
                  {editingQuantityId === item.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveQuantity(item.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="w-12 h-6 text-center text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        min="1"
                      />
                      <button onClick={() => saveQuantity(item.id)} className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center text-xs">✓</button>
                      <button onClick={cancelEditing} className="w-6 h-6 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded flex items-center justify-center text-xs">✕</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center font-bold text-gray-500 text-xs">-</button>
                      <button onClick={() => startEditingQuantity(item.id, item.quantity)} className="w-8 h-6 bg-gray-50 hover:bg-gray-100 rounded flex items-center justify-center font-bold text-[#111827] text-xs">
                        {item.quantity}
                      </button>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center font-bold text-gray-500 text-xs">+</button>
                      <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 bg-red-50 hover:bg-red-100 rounded flex items-center justify-center text-red-400 text-xs ml-0.5">&#x2715;</button>
                    </>
                  )}
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
                  {editingQuantityId === item.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveQuantity(item.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="w-12 h-6 text-center text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        min="1"
                      />
                      <button onClick={() => saveQuantity(item.id)} className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center text-xs">✓</button>
                      <button onClick={cancelEditing} className="w-6 h-6 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded flex items-center justify-center text-xs">✕</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">-</button>
                      <button onClick={() => startEditingQuantity(item.id, item.quantity)} className="w-8 h-6 bg-gray-50 hover:bg-gray-100 rounded flex items-center justify-center font-bold text-[#111827] text-xs">
                        {item.quantity}
                      </button>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center font-bold text-gray-500 text-xs">+</button>
                      <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 bg-red-50 hover:bg-red-100 rounded flex items-center justify-center text-red-400 text-xs ml-0.5">&#x2715;</button>
                    </>
                  )}
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