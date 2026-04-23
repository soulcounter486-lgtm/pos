'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import ReceiptModal from '@/components/ReceiptModal';

type Product = { id: string; name: string; category: string; price: number; barcode?: string; stock: number; image_url?: string; tax_rate?: number };
type CartItem = Product & { quantity: number };
type Table = { id: string; name: string; status: string };
type OrderData = { id: string; table_id: string; total: number; status: string; created_at: string; total_amount?: number; tax_amount?: number };
type OrderItemData = { id: string; order_id: string; product_id: string; quantity: number; price: number; unit_price?: number; status: string; note?: string };
type Settings = { bank_name: string; account_number: string; account_holder: string; receipt_header: string; staff_header_text: string };

export default function StaffPos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartMemos, setCartMemos] = useState<Record<string, string>>({});
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
  const [currentView, setCurrentView] = useState<'orders' | 'menu' | 'merged-orders'>('orders');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<OrderData[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  // 완료 주문 수량 로컬 편집 (주문하기 클릭 전까지 DB 미반영)
  const [localQtyEdits, setLocalQtyEdits] = useState<Record<string, number>>({});
  // 추가 서비스 기능
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [localPriceEdits, setLocalPriceEdits] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('pos_price_edits') || '{}'); } catch { return {}; }
  });
  const [addonItemsMap, setAddonItemsMap] = useState<Record<string, { qty: number; unitPrice: number; productId: string; name: string }>>({});
  const [addonOrderIds, setAddonOrderIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pos_addon_order_ids') || '[]'); } catch { return []; }
  });

  // 히스토리 기능
  type HistoryEntry = {
    id: string;
    timestamp: string;
    tableNumber: string;
    items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
    totalAmount: number;
    type: 'order' | 'edit';
  };
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  function getOrderHistory(): HistoryEntry[] {
    try { return JSON.parse(localStorage.getItem('pos_order_history') || '[]'); } catch { return []; }
  }
  function saveOrderHistory(entry: HistoryEntry) {
    const history = getOrderHistory();
    const updated = [entry, ...history].slice(0, 100);
    localStorage.setItem('pos_order_history', JSON.stringify(updated));
  }
  function formatHistoryTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // 합석 기능
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [mergedTables, setMergedTables] = useState<string[]>([]); // numeric table IDs
  const [showMergedPaymentModal, setShowMergedPaymentModal] = useState(false);
  // 영수증 · 설정
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showTransferQR, setShowTransferQR] = useState(false);
  const [settings, setSettings] = useState<Settings>({ bank_name: '', account_number: '', account_holder: '', receipt_header: 'POS 레스토랑', staff_header_text: '회사아이콘 pos 시스템' });

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
    localStorage.setItem('pos_price_edits', JSON.stringify(localPriceEdits));
  }, [localPriceEdits]);

  useEffect(() => {
    setLocalPriceEdits({});
    localStorage.removeItem('pos_price_edits');
  }, [selectedTable]);

  // 실시간 구독 - 주방에서 처리완료 시 직원 화면 자동 업데이트
  useEffect(() => {
    try {
      const s = getSupabase();
      const channel = s.channel('staff-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
        .subscribe();
      return () => { s.removeChannel(channel); };
    } catch (e) {
      console.error('Realtime subscription error:', e);
    }
  }, []);

  // 자동 이동 effect 제거 — orders 뷰 빈 상태에서는 직접 버튼으로 메뉴 이동

  // isOrderComplete 이펙트 제거 — 주문 후 내비게이션은 submitOrder 내부에서 처리

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const [priceInputStr, setPriceInputStr] = useState<string>('');

  async function fetchSettings() {
    try {
      const s = getSupabase();
      const { data } = await s.from('settings').select('*').eq('id', 'default').single();
      if (data) setSettings({ bank_name: data.bank_name || '', account_number: data.account_number || '', account_holder: data.account_holder || '', receipt_header: data.receipt_header || 'POS 레스토랑', staff_header_text: data.staff_header_text || '회사아이콘 pos 시스템' });
    } catch (e) { console.warn('설정 로드 실패 (settings 테이블 없음):', e); }
  }

  async function loadAllData() { await Promise.all([fetchProducts(), fetchTables(), fetchOrders(), fetchSettings()]); setDataLoaded(true); }

  async function fetchProducts() {
    setLoading(true);
    try {
      const s = getSupabase();
      const { data, error } = await s.from('products').select('*').order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (e) { setMessage('상품 목록을 불러오지 못했습니다.'); }
    setLoading(false);
  }

  async function fetchTables() {
    setLoadingTables(true);
    try {
      const s = getSupabase();
      const { data, error } = await s.from('tables').select('*');
      if (error) throw error;
      setTables(data || []);
    } catch (e) { console.error('Table error:', e); }
    setLoadingTables(false);
  }

  async function fetchOrders() {
    try {
      const s = getSupabase();
      const { data: orders, error: ordersError } = await s.from('orders').select('*').order('created_at', { ascending: false });
      const { data: items, error: itemsError } = await s.from('order_items').select('*');
      if (ordersError) console.error('orders 조회 오류:', ordersError);
      if (itemsError) console.error('order_items 조회 오류:', itemsError);
      setAllOrders(orders || []);
      setAllOrderItems(items || []);
    } catch (e) { console.error('Orders error:', e); }
  }

  function navigateTo(view: 'orders' | 'menu') {
    setCurrentView(view);
    window.history.pushState({ ts: selectedTable, view }, '', `/staff?table=${selectedTable}&view=${view}`);
  }

  function selectTable(tableId: string, view: 'orders' | 'menu' = 'menu') {
    const tableIdNum = tableId.replace(/\D/g, '');
    setSelectedTable(tableIdNum);
    setCurrentView(view);
    window.history.pushState({ ts: tableId, view }, '', `/staff?table=${tableId}&view=${view}`);
  }

  function goBack() {
    setSelectedTable(null); setCurrentView('orders'); setPendingOrders([]); setShowPaymentModal(false);
    setLocalQtyEdits({});
    window.history.replaceState({ main: true }, '', '/staff');
  }

  async function deleteAllOrdersForTable(tableUuid: string) {
    if (!confirm('테이블의 모든 주문을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const s = getSupabase();
      const { data: orders } = await s.from('orders').select('id').eq('table_id', tableUuid);
      const ids = orders?.map((o: any) => o.id) || [];
      if (ids.length > 0) await s.from('order_items').delete().in('order_id', ids);
      const { error } = await s.from('orders').delete().eq('table_id', tableUuid);
      if (error) throw error;
      await fetchOrders();
      setMessage('삭제되었습니다.');
    } catch (e) { console.error(e); setMessage('삭제 실패'); }
    finally { setLoading(false); }
  }

  // 기존 주문 아이템 수량 수정
  // - 완료주문 + 증가(+): 기존 수량 유지, 추가분만 새 pending 주문으로 주방 전송
  // - 완료주문 + 감소(-): 기존 수량 감소 + 주방에 취소 알림
  // - 대기주문: 기존대로 수량만 업데이트
  async function updateOrderItemQuantity(itemId: string, orderId: string, delta: number) {
    const item = allOrderItems.find(i => i.id === itemId);
    if (!item) return;
    const order = allOrders.find(o => o.id === orderId);
    const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
    const s = getSupabase();
    setLoading(true);

    const sendToKitchen = async (qty: number, note: string) => {
      const { data: ko } = await s.from('orders').insert({
        table_id: order?.table_id,
        total_amount: unitPrice * qty,
        status: 'pending',
      }).select().single();
      if (!ko) return;
      const ki = { order_id: ko.id, product_id: item.product_id, quantity: qty, price: unitPrice * qty, note };
      let { error: kiErr } = await s.from('order_items').insert(ki);
      if (kiErr && (kiErr.code === '42703' || kiErr.message?.includes('note'))) {
        const { note: _n, ...kiNoNote } = ki;
        await s.from('order_items').insert(kiNoNote);
      }
    };

    try {
      if (order?.status === 'completed' && delta > 0) {
        // 완료 주문 수량 추가: 기존 수량 변경 없이 추가분만 주방 대기로 전송
        await sendToKitchen(delta, `[추가] +${delta}개`);
      } else {
        // 그 완: 기존 수량 업데이트
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
          await s.from('order_items').delete().eq('id', itemId);
          const remaining = allOrderItems.filter(i => i.order_id === orderId && i.id !== itemId);
          if (remaining.length === 0) await s.from('orders').delete().eq('id', orderId);
        } else {
          await s.from('order_items').update({ quantity: newQty, price: unitPrice * newQty }).eq('id', itemId);
        }
        // 완료 주문 수량 감소/삭제 → 주방에 취소 알림
        if (order?.status === 'completed') {
          const cancelQty = newQty <= 0 ? item.quantity : Math.abs(delta);
          await sendToKitchen(cancelQty, `[취소] ${cancelQty}개`);
        }
      }
      await fetchOrders();
    } catch (e) { console.error(e); setMessage('수정 실패'); }
    finally { setLoading(false); }
  }

  // 주문내역 화면의 [주문하기] 버튼: 로컬 수량 편집을 DB/주방에 반영
  // key 형식: "merged-{productId}" (완료 주문 합산 항목) or itemId (대기 주문 개별 항목)
  async function submitOrderEdits() {
    const edits = Object.entries(localQtyEdits).filter(([, d]) => d !== 0);
    if (edits.length === 0 && Object.keys(addonItemsMap).length === 0) return;
    setLoading(true);
    const s = getSupabase();
    const tableUuid = tables.find(t => t.name.replace(/\D/g, '') === selectedTable)?.id;

    const kitchenInsert = async (tblId: string, productId: string, unitPrice: number, qty: number, note: string) => {
      const { data: ko } = await s.from('orders').insert({
        table_id: tblId,
        total_amount: unitPrice * qty,
        status: 'pending',
      }).select().single();
      if (!ko) return;
      const ki = { order_id: ko.id, product_id: productId, quantity: qty, price: unitPrice * qty, note };
      let { error: kiErr } = await s.from('order_items').insert(ki);
      if (kiErr && (kiErr.code === '42703' || kiErr.message?.includes('note'))) {
        const { note: _n, ...kiNoNote } = ki;
        await s.from('order_items').insert(kiNoNote);
      }
    };

    try {
      for (const [key, delta] of edits) {
        if (delta === 0) continue;

        if (key.startsWith('merged-')) {
          // 완료 주문 합산 항목: product_id 기준으로 처리
          const productId = key.slice('merged-'.length);
          if (!tableUuid) continue;
          const completedOrderIds = allOrders
            .filter(o => String(o.table_id) === String(tableUuid) && o.status === 'completed')
            .map(o => o.id);
          const relevantItems = allOrderItems.filter(i => completedOrderIds.includes(i.order_id) && i.product_id === productId);
          if (relevantItems.length === 0) continue;
          const unitPrice = relevantItems[0].unit_price || (relevantItems[0].quantity > 0 ? relevantItems[0].price / relevantItems[0].quantity : relevantItems[0].price);

          if (delta > 0) {
            await kitchenInsert(tableUuid, productId, unitPrice, delta, `[추가] +${delta}개`);
          } else {
            let toReduce = Math.abs(delta);
            for (const item of relevantItems) {
              if (toReduce <= 0) break;
              if (item.quantity <= toReduce) {
                await s.from('order_items').delete().eq('id', item.id);
                const siblings = allOrderItems.filter(i => i.order_id === item.order_id && i.id !== item.id);
                if (siblings.length === 0) await s.from('orders').delete().eq('id', item.order_id);
                toReduce -= item.quantity;
              } else {
                const newQty = item.quantity - toReduce;
                await s.from('order_items').update({ quantity: newQty, price: unitPrice * newQty }).eq('id', item.id);
                toReduce = 0;
              }
            }
            await kitchenInsert(tableUuid, productId, unitPrice, Math.abs(delta), `[취소] ${Math.abs(delta)}개`);
          }
        } else {
          // 대기 주문 개별 항목 (item ID 기준)
          const item = allOrderItems.find(i => i.id === key);
          if (!item) continue;
          const order = allOrders.find(o => o.id === item.order_id);
          const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);

          if (delta > 0) {
            await kitchenInsert(String(order?.table_id || ''), item.product_id, unitPrice, delta, `[추가] +${delta}개`);
          } else {
            const newQty = item.quantity + delta;
            if (newQty <= 0) {
              await s.from('order_items').delete().eq('id', key);
              const siblings = allOrderItems.filter(i => i.order_id === item.order_id && i.id !== key);
              if (siblings.length === 0) await s.from('orders').delete().eq('id', item.order_id);
            } else {
              await s.from('order_items').update({ quantity: newQty, price: unitPrice * newQty }).eq('id', key);
            }
            await kitchenInsert(String(order?.table_id || ''), item.product_id, unitPrice, Math.abs(delta), `[취소] ${Math.abs(delta)}개`);
          }
        }
      }
      // 추가 서비스 아이템 처리
      for (const [, info] of Object.entries(addonItemsMap)) {
        const overriddenPrice = localPriceEdits[info.productId] ?? info.unitPrice;
        const { data: ko } = await s.from('orders').insert({
          table_id: tableUuid,
          total_amount: overriddenPrice * info.qty,
          status: 'pending',
        }).select().single();
        if (ko) {
          await s.from('order_items').insert({
            order_id: ko.id,
            product_id: info.productId,
            quantity: info.qty,
            price: overriddenPrice * info.qty,
          });
          const newIds = [...addonOrderIds, ko.id];
          setAddonOrderIds(newIds);
          localStorage.setItem('pos_addon_order_ids', JSON.stringify(newIds));
        }
      }
      // 히스토리 저장 (추가 서비스)
      const addonHistItems = Object.values(addonItemsMap).map(info => {
        const p = products.find(pr => pr.id === info.productId);
        const up = localPriceEdits[info.productId] !== undefined ? localPriceEdits[info.productId] : info.unitPrice;
        return { name: p?.name || info.name, quantity: info.qty, unitPrice: up, totalPrice: up * info.qty };
      });
      if (addonHistItems.length > 0) {
        saveOrderHistory({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          tableNumber: String(selectedTable),
          items: addonHistItems,
          totalAmount: addonHistItems.reduce((s, i) => s + i.totalPrice, 0),
          type: 'edit',
        });
      }
      // 추가 주문 완료 항목 중 가격을 0으로 수정한 경우 DB 업데이트 (서비스 전환)
      const addonNormalCandidates = allOrders.filter(o => addonOrderIds.includes(o.id) && o.status === 'completed');
      for (const order of addonNormalCandidates) {
        const items = allOrderItems.filter(i => i.order_id === order.id);
        const allEditedToZero = items.length > 0 && items.every(i =>
          localPriceEdits[i.product_id] !== undefined && localPriceEdits[i.product_id] === 0
        );
        if (allEditedToZero) {
          for (const item of items) {
            await s.from('order_items').update({ price: 0 }).eq('id', item.id);
          }
          await s.from('orders').update({ total_amount: 0 }).eq('id', order.id);
        }
      }
      setAddonItemsMap({});
      localStorage.removeItem('pos_price_edits');
      setLocalPriceEdits({});
      setLocalQtyEdits({});
      await fetchOrders();
      setMessage('주문 수정이 완료되었습니다!');
    } catch (e) { console.error(e); setMessage('수정 실패'); }
    finally { setLoading(false); }
  }

  const tableOrderInfo: Record<string, { orders: OrderData[]; totalAmount: number }> = useMemo(() => {
    const info: Record<string, { orders: OrderData[]; totalAmount: number }> = {};
    allOrders.filter(order => ['pending', 'completed'].includes(order.status)).forEach(order => {
      const key = String(order.table_id).replace(/\D/g, '');
      if (!info[key]) info[key] = { orders: [], totalAmount: 0 };
      info[key].orders.push(order);
      const orderTotal = order.total_amount !== undefined ? order.total_amount : order.total;
      info[key].totalAmount += orderTotal;
    });
    return info;
  }, [allOrders]);

  function addToCart(product: Product) {
    const ex = cart.find(i => i.id === product.id);
    if (ex) {
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  }

  function updateQuantity(productId: string, delta: number) {
    setCart(prev =>
      prev.reduce<CartItem[]>((acc, i) => {
        if (i.id !== productId) { acc.push(i); return acc; }
        const n = i.quantity + delta;
        if (n > 0) acc.push({ ...i, quantity: n });
        // n === 0 이면 항목 삭제 (acc에 push 안 함)
        return acc;
      }, [])
    );
  }

  function startEditingQuantity(productId: string, currentQuantity: number) {
    setEditingQuantityId(productId);
    setQuantityInput(currentQuantity.toString());
  }

  function saveQuantity(productId: string) {
    const newQuantity = parseInt(quantityInput);
    if (isNaN(newQuantity) || newQuantity < 1) {
      // 0 이하 입력 시 해당 항목 삭제
      setCart(cart.filter(i => i.id !== productId));
      setEditingQuantityId(null);
      setQuantityInput('');
      return;
    }
    setCart(cart.map(i => i.id === productId ? { ...i, quantity: newQuantity } : i));
    setEditingQuantityId(null);
    setQuantityInput('');
  }

  function cancelEditing() { setEditingQuantityId(null); setQuantityInput(''); }

  function removeFromCart(productId: string) {
    setCart(cart.filter(i => i.id !== productId));
    setCartMemos(prev => { const m = { ...prev }; delete m[productId]; return m; });
  }

  async function submitOrder() {
    if (!selectedTable) { setMessage('테이블을 선택하세요'); return; }
    if (cart.length === 0) return;

    const total = cart.reduce((s, i) => s + i.price * i.quantity * (1 + (i.tax_rate || 0.1)), 0);

    setLoading(true);
    try {
      const s = getSupabase();
      const selectedTableId = tables.find(t => t.name.replace(/\D/g, '') === selectedTable)?.id;
      if (!selectedTableId) throw new Error('테이블을 찾을 수 없습니다: ' + selectedTable);

      type InsertResult = { data: { id: string } | null; error: { code?: string; message?: string } | null };
      const isColErr = (e: { code?: string; message?: string } | null) =>
        !!e && (e.code === '42703' || /column.*does not exist|Could not find.*column/i.test(e.message || ''));

      // 전체 주문 → pending (주방 전송, 음료 포함)
      let od: { id: string } | null = null;
      let oe: { code?: string; message?: string } | null = null;
      ({ data: od, error: oe } = await s.from('orders').insert({ table_id: selectedTableId, total_amount: total, status: 'pending' }).select().single() as InsertResult);
      if (isColErr(oe)) ({ data: od, error: oe } = await s.from('orders').insert({ table_id: selectedTableId, total: total, status: 'pending' }).select().single() as InsertResult);
      if (isColErr(oe)) ({ data: od, error: oe } = await s.from('orders').insert({ table_id: selectedTableId, status: 'pending' }).select().single() as InsertResult);
      if (oe) throw new Error(oe.message || '주문 저장 오류');
      if (!od) throw new Error('주문 생성 실패');

      // 아이템 insert (note 컬럼 없으면 fallback)
      const withNote = cart.map(i => ({ order_id: od!.id, product_id: i.id, quantity: i.quantity, price: i.price * i.quantity, note: cartMemos[i.id] || null }));
      let { error: itemErr } = await s.from('order_items').insert(withNote);
      if (itemErr && (itemErr.code === '42703' || itemErr.message?.includes('note'))) {
        const withoutNote = withNote.map(({ note, ...rest }) => rest);
        ({ error: itemErr } = await s.from('order_items').insert(withoutNote));
      }
      if (itemErr) throw itemErr;

      saveOrderHistory({
        id: od!.id + '_' + Date.now(),
        timestamp: new Date().toISOString(),
        tableNumber: String(selectedTable),
        items: cart.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.price, totalPrice: i.price * i.quantity })),
        totalAmount: total,
        type: 'order',
      });
      setCart([]);
      setCartMemos({});
      setMessage('주문이 완료되었습니다!');
      navigateTo('orders');
      fetchOrders();
    } catch (e: unknown) {
      console.error('주문 처리 중 오류 발생:', e);
      let errMsg = '';
      if (e instanceof Error) errMsg = e.message;
      else if (typeof e === 'object' && e !== null && 'message' in e) errMsg = String((e as Record<string, unknown>).message);
      else errMsg = JSON.stringify(e);
      setMessage('주문 처리 중 오류 발생: ' + errMsg);
    } finally { setLoading(false); }
  }

  const cartTotal = useMemo(() => {
    const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
    const tax = cart.reduce((t, item) => t + (item.price * item.quantity * (item.tax_rate || 0.1)), 0);
    return subtotal + tax;
  }, [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((a, i) => a + i.price * i.quantity, 0), [cart]);
  const cartTax = useMemo(() => Math.round(cartSubtotal * 0.1), [cartSubtotal]);

  const categories = useMemo(() => ['all', ...new Set(products.map(p => p.category))], [products]);
  const filteredProducts = useMemo(() => {
    let f = products;
    if (selectedCategory !== 'all') f = f.filter(p => p.category === selectedCategory);
    if (searchTerm) f = f.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return f;
  }, [products, selectedCategory, searchTerm]);

  function issueReceipt() {
    setShowReceiptModal(true);
  }

  async function completePayment(method: string) {
    setShowPaymentModal(false);
    const orders = pendingOrders;
    const tableId = selectedTable;
    if (!tableId || orders.length === 0) return;
    const total = orders.reduce((s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0);
    const orderIds = orders.map(o => o.id);
    // 테이블 UUID 조회 (orders.table_id 는 UUID)
    const tableUuid = tables.find(t => t.name.replace(/\D/g, '') === tableId)?.id;
    setLoading(true);
    try {
      const supabase = getSupabase();
      try {
        await supabase.from('sales').insert({
          table_id: tableUuid ?? tableId,
          total_amount: total,
          payment_method: method,
          order_count: orders.length
        });
      } catch (e: unknown) { console.error('Sales insert error:', e instanceof Error ? e.message : e); }

      // 결제 완료: order_items → orders 순서로 삭제하여 테이블을 사용 가능 상태로 초기화
      if (orderIds.length > 0) {
        await supabase.from('order_items').delete().in('order_id', orderIds);
        const { error: ordersDeleteErr } = await supabase.from('orders').delete().in('id', orderIds);
        if (ordersDeleteErr) throw ordersDeleteErr;
      }
      setCurrentView('orders');
      setPendingOrders([]);
      setSelectedTable(null);
      setMessage('결제 완료! 테이블이 초기화되었습니다.');
      await fetchOrders();
    } catch (e: unknown) {
      console.error('결제 에러:', e);
      setCurrentView('orders');
      setPendingOrders([]);
      setSelectedTable(null);
      const errMsg = e instanceof Error ? e.message : '알수없음';
      setMessage('결제 오류: ' + errMsg);
      await fetchOrders();
    } finally { setLoading(false); }
  }

  // ==================== 합석 기능 ====================

  function toggleMergeMode() {
    setIsMergeMode(prev => !prev);
    setMergedTables([]);
  }

  function toggleMergeTable(tableId: string) {
    setMergedTables(prev =>
      prev.includes(tableId) ? prev.filter(t => t !== tableId) : [...prev, tableId]
    );
  }

  function openMergedOrders() {
    setCurrentView('merged-orders');
  }

  function exitMergedOrders() {
    setCurrentView('orders');
  }

  async function completeMergedPayment(method: string) {
    setShowMergedPaymentModal(false);
    if (mergedTables.length === 0) return;

    // 선택된 모든 테이블의 UUID 목록
    const mergedUuids = mergedTables
      .map(ts => tables.find(t => t.name.replace(/\D/g, '') === ts)?.id)
      .filter((id): id is string => !!id);

    // 결제 금액: pending + completed(조리완료) 전부 포함
    const allActiveOrders = allOrders.filter(o =>
      mergedUuids.some(uid => String(uid) === String(o.table_id)) && (o.status === 'pending' || o.status === 'completed')
    );
    if (allActiveOrders.length === 0) {
      setMessage('결제할 주문이 없습니다.');
      return;
    }
    const activeTotal = allActiveOrders.reduce(
      (s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0
    );
    const allActiveOrderIds = allActiveOrders.map(o => o.id);

    setLoading(true);
    try {
      const supabase = getSupabase();

      // 1. sales 테이블에 합산 기록
      try {
        await supabase.from('sales').insert({
          table_id: mergedUuids[0],
          total_amount: activeTotal,
          payment_method: method,
          order_count: allActiveOrderIds.length
        });
      } catch (e: unknown) { console.error('Sales insert error (merged):', e instanceof Error ? e.message : e); }

      // 2. 선택 테이블 order_items 전부 삭제
      if (allActiveOrderIds.length > 0) {
        await supabase.from('order_items').delete().in('order_id', allActiveOrderIds);
      }

      // 3. 선택 테이블 orders 전부 삭제 → 테이블 사용 가능 상태로 초기화
      if (allActiveOrderIds.length > 0) {
        const { error: ordersDeleteErr } = await supabase
          .from('orders').delete().in('id', allActiveOrderIds);
        if (ordersDeleteErr) throw ordersDeleteErr;
      }

      // 4. 상태 초기화
      setMergedTables([]);
      setIsMergeMode(false);
      setCurrentView('orders');
      setMessage('합석 결제 완료! 테이블이 초기화되었습니다.');
      await fetchOrders();
    } catch (e: unknown) {
      console.error('합석 결제 에러:', e);
      const errMsg = e instanceof Error ? e.message : '알수없음';
      setMessage('합석 결제 오류: ' + errMsg);
    } finally { setLoading(false); }
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
  if (!selectedTable && currentView !== 'merged-orders') {
    // 합석 모드에서 선택된 테이블들의 총 금액 계산
    const mergedGrandTotal = mergedTables.reduce((sum, ts) => {
      const tableUuid = tables.find(t => t.name.replace(/\D/g, '') === ts)?.id;
      if (!tableUuid) return sum;
      const orders = allOrders.filter(o => String(o.table_id) === String(tableUuid) && (o.status === 'pending' || o.status === 'completed'));
      return sum + orders.reduce((s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0);
    }, 0);

    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <header className="bg-white border-b border-[#E5E7EB] px-6 lg:px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#111827]">직원 POS</h1>
              <p className="text-sm text-[#9CA3AF] mt-0.5">{allOrders.filter(o => o.status === 'pending').length}건 대기 주문</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowHistory(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-white border border-blue-200 text-blue-600 hover:bg-blue-50">
                📋 히스토리
              </button>
              <button onClick={toggleMergeMode}
                className={'px-4 py-2 rounded-xl text-sm font-semibold transition-all ' +
                  (isMergeMode
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-white border border-purple-200 text-purple-600 hover:bg-purple-50')}>
                {isMergeMode ? '✕ 합석 취소' : '🪑 합석'}
              </button>
            </div>
          </div>
          {/* 합석 모드 안내 배너 */}
          {isMergeMode && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-purple-700">합석 모드</p>
                <p className="text-xs text-purple-500">
                  {mergedTables.length === 0
                    ? '결제할 테이블을 2개 이상 선택하세요'
                    : `Table ${mergedTables.join(', ')} 선택됨 · ${mergedGrandTotal.toLocaleString()} VND`}
                </p>
              </div>
              {mergedTables.length >= 2 && (
                <button onClick={openMergedOrders}
                  className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                  합산 보기
                </button>
              )}
            </div>
          )}
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {tables.sort((a, b) => {
              const aNum = parseInt(a.name.match(/\d+/)?.[0] || '0');
              const bNum = parseInt(b.name.match(/\d+/)?.[0] || '0');
              return aNum - bNum;
            }).map(table => {
              const ts = table.name.replace(/\D/g, '');
              const tableOrders = allOrders.filter(order => String(order.table_id) === String(table.id));
              const hasPendingOrders = tableOrders.some(o => o.status === 'pending');
              const hasCompletedOrders = tableOrders.some(o => o.status === 'completed') && !hasPendingOrders;
              const total = tableOrders.reduce((sum, order) => {
                return sum + allOrderItems.filter(i => i.order_id === order.id).reduce((s, item) => {
                  const isCompleted = order.status === 'completed';
                  const up = (isCompleted && localPriceEdits[item.product_id] !== undefined)
                    ? localPriceEdits[item.product_id]
                    : (item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price));
                  const product = products.find(p => p.id === item.product_id);
                  const taxRate = product?.tax_rate ?? 0.1;
                  return s + up * item.quantity;
                }, 0);
              }, 0);
              const totalOrders = tableOrders.length;
              const pendingCount = tableOrders.filter(o => o.status === 'pending').length;
              const isMergeSelected = mergedTables.includes(ts);

              // 합석 모드: 클릭 시 테이블 선택 토글 / 주문 있으면 주문내역, 없으면 메뉴로 이동
              const handleClick = isMergeMode
                ? () => toggleMergeTable(ts)
                : () => selectTable(ts, tableOrders.length > 0 ? 'orders' : 'menu');

              return (
                <button key={table.id} onClick={handleClick}
                  className={'relative bg-white rounded-2xl p-4 lg:p-5 border transition-all duration-200 text-left ' +
                    (isMergeMode
                      ? (isMergeSelected
                        ? 'border-purple-400 ring-2 ring-purple-300 shadow-md bg-purple-50'
                        : 'border-gray-100 hover:border-purple-200 hover:shadow-md')
                      : (hasCompletedOrders
                        ? 'border-green-200 hover:shadow-md hover:-translate-y-0.5'
                        : hasPendingOrders
                          ? 'border-red-200 hover:shadow-md hover:-translate-y-0.5'
                          : 'border-gray-100 hover:shadow-md hover:-translate-y-0.5'))}>
                  {/* 상태 dot 또는 합석 체크마크 */}
                  {isMergeMode ? (
                    <div className={'absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ' +
                      (isMergeSelected ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-400')}>
                      {isMergeSelected ? '✓' : ''}
                    </div>
                  ) : (
                    <div className={'absolute top-3 right-3 w-3 h-3 rounded-full ' +
                      (hasCompletedOrders ? 'bg-green-400' : hasPendingOrders ? 'bg-red-400 animate-pulse' : 'bg-gray-300')}></div>
                  )}
                  <div className="text-base lg:text-lg font-medium mb-2 text-[#111827]">Table {table.name}</div>
                  <div className={'text-xs lg:text-sm font-medium mb-2 lg:mb-3 ' +
                    (isMergeMode && isMergeSelected
                      ? 'text-purple-600'
                      : hasCompletedOrders ? 'text-green-500' : hasPendingOrders ? 'text-red-500' : 'text-gray-500')}>
                    {isMergeMode && isMergeSelected
                      ? '합석 선택됨'
                      : hasCompletedOrders ? '조리 완료' : hasPendingOrders ? '주문 대기' : '사용 가능'}
                  </div>
                  {total > 0 && (
                    <div className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 rounded-lg px-2 lg:px-3 py-1.5">공급가액 {total.toLocaleString()} VND</div>
                  )}
                  {totalOrders > 0 && (
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] lg:text-xs text-gray-400">{totalOrders}건</span>
                      {pendingCount > 0 && <span className="text-[10px] lg:text-xs text-amber-500">{pendingCount}건 대기</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </main>
        {message && (<div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1F2937] text-white px-5 py-3 rounded-full shadow-lg text-sm z-50">{message}</div>)}
      </div>
    );
  }

  // ==================== 합석 주문내역 뷰 ====================
  if (currentView === 'merged-orders') {
    // 선택된 모든 테이블의 UUID 목록
    const mergedUuids = mergedTables
      .map(ts => tables.find(t => t.name.replace(/\D/g, '') === ts)?.id)
      .filter((id): id is string => !!id);

    // 합산 주문 + 합계
    const mergedAllOrders = allOrders.filter(o =>
      mergedUuids.some(uid => String(uid) === String(o.table_id)) && (o.status === 'pending' || o.status === 'completed')
    );
    const mergedGrandTotal = mergedAllOrders.reduce((s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0);
    // 결제 금액은 pending 주문만 (기존 결제 기준과 일치)
    const mergedPendingForPayment = mergedAllOrders.filter(o => o.status === 'pending');
    const mergedPendingTotal = mergedPendingForPayment.reduce((s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0);
    const mergedHasPending = mergedPendingForPayment.length > 0;

    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <header className="bg-white border-b border-[#E5E7EB] px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={exitMergedOrders} className="text-gray-400 hover:text-[#111827] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-[#111827]">합석 주문</h1>
                <p className="text-xs text-purple-500">Table {mergedTables.join(' + ')} · {mergedTables.length}개 테이블</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">합석 모드</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 space-y-3 max-w-3xl mx-auto w-full pb-28">
          {mergedTables.map(ts => {
            const tableUuid = tables.find(t => t.name.replace(/\D/g, '') === ts)?.id;
            if (!tableUuid) return null;
            const tableOrders = allOrders.filter(o => String(o.table_id) === String(tableUuid) && (o.status === 'pending' || o.status === 'completed'));
            const tableTotal = tableOrders.reduce((s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0);
            const hasPending = tableOrders.some(o => o.status === 'pending');
            if (tableOrders.length === 0) return null;
            return (
              <div key={ts} className={'bg-white rounded-xl shadow-sm border overflow-hidden ' + (hasPending ? 'border-amber-100' : 'border-green-100')}>
                <div className={'px-4 py-3 border-b border-gray-50 flex items-center justify-between ' + (hasPending ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100')}>
                  <div className="flex items-center gap-2">
                    <span className={'w-2 h-2 rounded-full ' + (hasPending ? 'bg-amber-400' : 'bg-green-400')}></span>
                    <span className={'text-sm font-bold ' + (hasPending ? 'text-amber-700' : 'text-green-700')}>Table {ts}</span>
                    <span className={'text-xs ' + (hasPending ? 'text-amber-500' : 'text-green-500')}>{hasPending ? '주방 대기 중' : '조리 완료'}</span>
                  </div>
                  <span className={'text-sm font-bold ' + (hasPending ? 'text-amber-600' : 'text-green-600')}>
                    {tableTotal.toLocaleString()} VND
                  </span>
                </div>
                <div>
                  {tableOrders.flatMap(order =>
                    allOrderItems.filter(i => i.order_id === order.id).map(item => {
                      const product = products.find(p => p.id === item.product_id);
                      const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
                      const itemDone = item.status === 'completed';
                      return (
                        <div key={item.id} className={"flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 px-4" + (itemDone ? ' bg-green-50' : '')}>
                          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] text-gray-300">-</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={"text-xs font-medium truncate" + (itemDone ? ' text-green-600 line-through' : ' text-[#374151]')}>
                              {product?.name || '상품'}
                              {unitPrice === 0 && <span className="ml-1 text-[9px] font-bold text-pink-600 bg-pink-50 border border-pink-200 px-1 py-0.5 rounded">서비스</span>}
                            </p>
                            {unitPrice === 0
                              ? <p className="text-[10px] text-pink-500 font-medium">서비스 제공 (0 VND)</p>
                              : <p className="text-[10px] text-gray-400">공급가 {unitPrice.toLocaleString()} VND × {item.quantity} = {(unitPrice * item.quantity).toLocaleString()} VND</p>}
                            {item.note && <p className="text-[10px] text-blue-500 mt-0.5 bg-blue-50 px-1.5 py-0.5 rounded inline-block">📝 {item.note}</p>}
                          </div>
                          {itemDone ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">✅ 조리완료</span>
                          ) : (
                            <span className="text-xs font-bold text-[#374151] bg-gray-100 px-2 py-1 rounded flex-shrink-0 mt-0.5">{item.quantity}개</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {mergedAllOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="text-5xl mb-3">📭</span>
              <p>선택된 테이블에 주문이 없습니다</p>
            </div>
          )}
        </main>

        {/* 하단 합계 + 결제 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 py-3 flex gap-2 shadow-lg z-30">
          <div className="flex-1 flex items-center justify-between px-2">
            <div>
              <p className="text-sm text-gray-600">결제 금액 <span className="text-xs text-purple-400">({mergedTables.length}개 테이블 · 대기 주문)</span></p>
              {mergedGrandTotal !== mergedPendingTotal && (
                <p className="text-[10px] text-gray-400">전체 {mergedGrandTotal.toLocaleString()} VND</p>
              )}
            </div>
            <span className="text-lg font-bold text-purple-600">{mergedPendingTotal.toLocaleString()} VND</span>
          </div>
          <button onClick={() => setShowMergedPaymentModal(true)}
            disabled={!mergedHasPending}
            className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors">
            합석 결제
          </button>
        </div>

        {/* 합석 결제 수단 모달 */}
        {showMergedPaymentModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-[#111827]">합석 결제 수단</h3>
                <p className="text-sm text-gray-400">
                  Table {mergedTables.join(' + ')} · {mergedPendingTotal.toLocaleString()} VND
                </p>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { key: 'cash', icon: '💵', name: '현금', sub: 'Cash' },
                  { key: 'card', icon: '💳', name: '카드', sub: 'Card' },
                  { key: 'transfer', icon: '🏦', name: '계좌이체', sub: 'Bank Transfer · QR' },
                ].map(m => (
                  <button key={m.key} onClick={() => completeMergedPayment(m.key)}
                    className="w-full flex items-center gap-4 bg-gray-50 hover:bg-gray-100 p-4 rounded-xl transition-colors text-left">
                    <span className="text-2xl">{m.icon}</span>
                    <div><p className="font-semibold text-[#111827]">{m.name}</p><p className="text-xs text-gray-400">{m.sub}</p></div>
                  </button>
                ))}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button onClick={() => setShowMergedPaymentModal(false)}
                  className="w-full text-gray-400 hover:text-[#374151] py-2 text-sm font-medium">취소</button>
              </div>
            </div>
          </div>
        )}

        {/* 주문 히스토리 사이드 패널 */}
        {showHistory && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowHistory(false)} />
            <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
              <div className="bg-[#1F2937] px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold">📋 주문 히스토리</h2>
                  <p className="text-xs text-gray-400 mt-0.5">최신순 · 최대 100건</p>
                </div>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {getOrderHistory().length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                    <span className="text-4xl mb-3">📭</span>
                    <p className="text-sm">주문 내역이 없습니다</p>
                  </div>
                ) : (
                  getOrderHistory().map((entry) => (
                    <div key={entry.id} className="border-b border-gray-100">
                      <button
                        onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold bg-[#1F2937] text-white px-2 py-0.5 rounded">Table {entry.tableNumber}</span>
                            {entry.type === 'edit' && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">추가 서비스</span>}
                            <span className="text-[10px] text-gray-400">{formatHistoryTime(entry.timestamp)}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{entry.items.map(i => i.name + ' ×' + i.quantity).join(', ')}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-bold text-blue-600">{entry.totalAmount.toLocaleString()} VND</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{expandedHistoryId === entry.id ? '▲' : '▼'}</p>
                        </div>
                      </button>
                      {expandedHistoryId === entry.id && (
                        <div className="px-4 pb-3 bg-gray-50">
                          {entry.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                              <div>
                                <p className="text-xs font-medium text-gray-700">{item.name}</p>
                                <p className="text-[10px] text-gray-400">단가 {item.unitPrice.toLocaleString()} VND × {item.quantity}</p>
                              </div>
                              <p className="text-xs font-bold text-gray-700">{item.totalPrice.toLocaleString()} VND</p>
                            </div>
                          ))}
                          <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                            <p className="text-xs font-bold text-gray-700">합계</p>
                            <p className="text-sm font-bold text-blue-600">{entry.totalAmount.toLocaleString()} VND</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {message && (<div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1F2937] text-white px-5 py-3 rounded-full shadow-lg text-sm z-40">{message}</div>)}
      </div>
    );
  }

  // ==================== 주문내역 뷰 ====================
  if (currentView === 'orders') {
    if (!selectedTable) { setCurrentView('menu'); return null; }
    if (!dataLoaded) {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
          <header className="bg-white border-b border-[#E5E7EB] px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={goBack} className="text-gray-400 hover:text-[#111827] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h1 className="text-lg font-bold text-[#111827]">{settings.staff_header_text || '회사아이콘 pos 시스템'}</h1>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-5xl mb-4 block">📭</span>
              <p className="text-gray-400 mb-6">주문 내역이 없습니다</p>
              <button onClick={() => navigateTo('menu')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20">
                메뉴에서 주문하기
              </button>
            </div>
          </main>
        </div>
      );
    }

    const selectedTableUuid = tables.find(t => t.name.replace(/\D/g, '') === selectedTable)?.id || null;
    if (!selectedTableUuid) { setCurrentView('menu'); return null; }

    const tableOrders = allOrders.filter(o => {
      const status = String(o.status).toLowerCase().trim();
      return String(o.table_id) === String(selectedTableUuid) && (status === 'completed' || status === 'pending');
    });

    const tablePendingOrders = tableOrders.filter(o => o.status === 'pending');
    const tableCompletedOrders = tableOrders.filter(o => o.status === 'completed');
    const grandTotal = tableOrders.reduce((s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0);
    const calcSupply = (orders) => orders.reduce((s, order) => {
      return s + allOrderItems.filter(i => i.order_id === order.id).reduce((sum, item) => {
        const isCompleted = order.status === 'completed';
        const up = (isCompleted && localPriceEdits[item.product_id] !== undefined)
          ? localPriceEdits[item.product_id]
          : (item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price));
        const product = products.find(p => p.id === item.product_id);
        const taxRate = product?.tax_rate ?? 0.1;
        return sum + up * item.quantity;
      }, 0);
    }, 0);
    const grandSupplyTotal = calcSupply(tableOrders);
    const pendingSupplyTotal = calcSupply(tablePendingOrders);
    const addonPreviewTotal = Object.entries(addonItemsMap).reduce((s, [, info]) => {
      const price = localPriceEdits[info.productId] !== undefined ? localPriceEdits[info.productId] : info.unitPrice;
      return s + price * info.qty;
    }, 0);
    const displaySupplyTotal = grandSupplyTotal + addonPreviewTotal;

    // addon 완료 주문 분리
    const baseCompletedOrders = tableCompletedOrders.filter(o => !addonOrderIds.includes(o.id));
    const addonCompletedOrders = tableCompletedOrders.filter(o => addonOrderIds.includes(o.id));
    const serviceCompletedOrders = addonCompletedOrders.filter(o => {
      const items = allOrderItems.filter(i => i.order_id === o.id);
      return items.length > 0 && items.every(i => {
        const effectivePrice = localPriceEdits[i.product_id] !== undefined ? localPriceEdits[i.product_id] : i.price;
        return effectivePrice === 0;
      });
    });
    const addonNormalCompletedOrders = addonCompletedOrders.filter(o => !serviceCompletedOrders.map(s => s.id).includes(o.id));

    // 완료 주문 항목을 product_id 기준으로 합산 (addon 제외)
    const mergedCompletedItems = (() => {
      const map = new Map<string, {
        virtualId: string; productId: string; totalQty: number; unitPrice: number; notes: string[];
      }>();
      baseCompletedOrders.forEach(order => {
        allOrderItems.filter(i => i.order_id === order.id).forEach(item => {
          const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
          const existing = map.get(item.product_id);
          if (existing) {
            existing.totalQty += item.quantity;
            if (item.note) existing.notes.push(item.note);
          } else {
            map.set(item.product_id, {
              virtualId: `merged-${item.product_id}`,
              productId: item.product_id,
              totalQty: item.quantity,
              unitPrice,
              notes: item.note ? [item.note] : [],
            });
          }
        });
      });
      return Array.from(map.values());
    })();

    if (tableOrders.length === 0) {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
          <header className="bg-white border-b border-[#E5E7EB] px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={goBack} className="text-gray-400 hover:text-[#111827]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-lg font-bold text-[#111827]">{settings.staff_header_text || '회사아이콘 pos 시스템'}</h1>
              </div>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-5xl mb-4 block">📭</span>
              <p className="text-gray-400 mb-6">주문 내역이 없습니다</p>
              <button onClick={() => navigateTo('menu')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20">
                메뉴에서 주문하기
              </button>
            </div>
          </main>
        </div>
      );
    }

    // deferred=true: 완료 주문 수량 편집 (주문하기 클릭 시 반영)
    // deferred=false: 대기 주문 수량 편집 (즉시 반영)
    const renderOrderItems = (order, editable, deferred = false) => {
      const items = allOrderItems.filter(i => i.order_id === order.id);
      return items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
        const supplyAmount = unitPrice * item.quantity;
        const localDelta = localQtyEdits[item.id] || 0;
        const displayQty = item.quantity + localDelta;
        const itemDone = item.status === 'completed';
        return (
          <div key={item.id} className={"flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 px-4" + (itemDone ? ' bg-green-50' : '')}>
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-gray-300">-</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={"text-xs font-medium truncate" + (itemDone ? ' text-green-600 line-through' : ' text-[#374151]')}>
                {product?.name || '상품'}
                {supplyAmount === 0 && <span className="ml-1 text-[9px] font-bold text-pink-600 bg-pink-50 border border-pink-200 px-1 py-0.5 rounded">서비스</span>}
              </p>
              {supplyAmount === 0
                ? <p className="text-[10px] text-pink-500 font-medium">서비스 제공 (0 VND)</p>
                : <p className="text-[10px] text-gray-400">공급가 {supplyAmount.toLocaleString()} VND</p>}
              {item.note && <p className="text-[10px] text-blue-500 mt-0.5 bg-blue-50 px-1.5 py-0.5 rounded inline-block">📝 {item.note}</p>}
              {!itemDone && deferred && localDelta !== 0 && (
                <p className={"text-[10px] mt-0.5 font-bold " + (localDelta > 0 ? 'text-green-600' : localDelta < 0 ? 'text-red-500' : 'text-[#111827]')}>
                  {localDelta > 0 ? '▲ +' + localDelta + '개 추가 예정' : '▼ ' + localDelta + '개 취소 예정'}
                </p>
              )}
            </div>
            {itemDone ? (
              <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">✅ 조리완료</span>
            ) : editable ? (
              deferred ? (
                <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => {
                      const curr = localQtyEdits[item.id] || 0;
                      const next = Math.max(-item.quantity, curr - 1);
                      setLocalQtyEdits(prev => ({ ...prev, [item.id]: next }));
                    }}
                    disabled={loading || displayQty <= 0}
                    className="w-7 h-7 bg-white hover:bg-red-100 hover:text-red-500 rounded-lg flex items-center justify-center text-red-400 text-sm font-bold disabled:opacity-40 transition-colors">−</button>
                  <span className={`w-7 text-center text-xs font-bold ${localDelta > 0 ? 'text-green-600' : localDelta < 0 ? 'text-red-500' : 'text-[#111827]'}`}>
                    {displayQty}
                  </span>
                  <button
                    onClick={() => setLocalQtyEdits(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                    disabled={loading}
                    className="w-7 h-7 bg-white hover:bg-blue-100 hover:text-blue-600 rounded-lg flex items-center justify-center text-green-500 text-sm font-bold disabled:opacity-40 transition-colors">+</button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                  <button onClick={() => updateOrderItemQuantity(item.id, order.id, -1)} disabled={loading}
                    className="w-7 h-7 bg-white hover:bg-red-100 hover:text-red-500 rounded-lg flex items-center justify-center text-red-400 text-sm font-bold disabled:opacity-40 transition-colors">−</button>
                  <span className="w-7 text-center text-xs font-bold text-[#111827]">{item.quantity}</span>
                  <button onClick={() => updateOrderItemQuantity(item.id, order.id, 1)} disabled={loading}
                    className="w-7 h-7 bg-white hover:bg-blue-100 hover:text-blue-600 rounded-lg flex items-center justify-center text-green-500 text-sm font-bold disabled:opacity-40 transition-colors">+</button>
                </div>
              )
            ) : (
              <span className="text-xs font-bold text-[#374151] bg-gray-100 px-2 py-1 rounded flex-shrink-0 mt-0.5">{item.quantity}개</span>
            )}
            {editingPriceId === order.id + '_n_' + item.product_id && (
              <div className='px-4 pb-2.5 flex items-center gap-2'>
                <span className='text-[10px] text-gray-500 shrink-0'>단가 수정:</span>
                <input
                  type='number'
                  value={priceInputStr}
                  onChange={e => setPriceInputStr(e.target.value)}
                  className='flex-1 text-xs border border-yellow-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-400'
                  placeholder='단가 입력'
                />
                <span className='text-[10px] text-gray-400 shrink-0'>VND</span>
                <button onClick={() => {
                  const val = priceInputStr === '' ? 0 : Math.max(0, Number(priceInputStr) || 0);
                  setLocalPriceEdits(prev => ({ ...prev, [item.product_id]: val }));
                  setEditingPriceId(null);
                }} className='text-[10px] text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded-lg font-bold shrink-0'>확인</button>
              </div>
            )}
          </div>
        );
      });
    };

    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <header className="bg-white border-b border-[#E5E7EB] px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={goBack} className="text-gray-400 hover:text-[#111827] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-[#111827]">{settings.staff_header_text || '회사아이콘 pos 시스템'}</h1>
                <p className="text-xs text-gray-400">주문내역 {tableOrders.length}건</p>
              </div>
            </div>
            <button onClick={() => deleteAllOrdersForTable(selectedTableUuid!)} disabled={tableOrders.length === 0 || loading}
              className="text-xs text-red-400 hover:text-red-500 disabled:opacity-40 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              전체삭제
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 space-y-3 max-w-3xl mx-auto w-full pb-28">
          {/* 대기 중인 주문 */}
          {tablePendingOrders.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                  <span className="text-sm font-bold text-amber-700">주방 대기 중</span>
                  <span className="text-xs text-amber-500">{tablePendingOrders.length}건</span>
                </div>
                <span className="text-sm font-bold text-amber-600">
                  {Math.round(pendingSupplyTotal).toLocaleString()} VND
                </span>
              </div>
              <div>
                {tablePendingOrders.flatMap(order => renderOrderItems(order, true))}
              </div>
            </div>
          )}

          {/* 조리 완료 주문 (product_id 기준 합산 표시) */}
          {mergedCompletedItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-sm font-bold text-green-700">조리 완료</span>
                  <span className="text-xs text-green-500">{mergedCompletedItems.length}종</span>
                </div>
                <span className="text-xs text-green-500">수량 변경 후 주문하기</span>
              </div>
              <div>
                {mergedCompletedItems.map(mitem => {
                  const product = products.find(p => p.id === mitem.productId);
                  const localDelta = localQtyEdits[mitem.virtualId] || 0;
                  const displayQty = mitem.totalQty + localDelta;
                  const effectivePrice = localPriceEdits[mitem.productId] !== undefined ? localPriceEdits[mitem.productId] : mitem.unitPrice;
                  const supplyAmount = effectivePrice * mitem.totalQty;
                  const addonEntry = addonItemsMap[mitem.virtualId];
                  const isEditingPrice = editingPriceId === mitem.virtualId;
                  const editedPrice = localPriceEdits[mitem.productId] ?? mitem.unitPrice;
                  return (
                    <div key={mitem.virtualId} className="border-b border-gray-50 last:border-0">
                      <div className="flex items-start gap-3 py-2.5 px-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-gray-300">-</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#374151] truncate">{product?.name || '상품'}</p>
                          <p className="text-[10px] text-gray-400">공급가 {supplyAmount.toLocaleString()} VND</p>
                          {mitem.notes.length > 0 && (
                            <p className="text-[10px] text-blue-500 mt-0.5 bg-blue-50 px-1.5 py-0.5 rounded inline-block">📝 {mitem.notes.join(', ')}</p>
                          )}
                          {localDelta !== 0 && (
                            <p className={`text-[10px] mt-0.5 font-bold ${localDelta > 0 ? 'text-green-600' : localDelta < 0 ? 'text-red-500' : 'text-[#111827]'}`}>
                              {localDelta > 0 ? '▲ +' + localDelta + '개 추가 예정' : '▼ ' + localDelta + '개 취소 예정'}
                            </p>
                          )}
                          {addonEntry && (
                            <p className="text-[10px] mt-0.5 font-bold text-purple-600">✨ 추가 {addonEntry.qty}개 · {(editedPrice * addonEntry.qty).toLocaleString()} VND</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setLocalQtyEdits(prev => ({ ...prev, ['merged-' + mitem.productId]: Math.max(-mitem.totalQty, (prev['merged-' + mitem.productId] || 0) - 1) })); }} disabled={loading} className="w-6 h-6 bg-white hover:bg-red-100 hover:text-red-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-gray-100">−</button>
                          <span className="text-xs font-bold text-[#374151] bg-gray-100 px-2 py-1 rounded flex-shrink-0">{mitem.totalQty + (localQtyEdits['merged-' + mitem.productId] || 0)}개</span>
                          <button onClick={() => { setLocalQtyEdits(prev => ({ ...prev, ['merged-' + mitem.productId]: (prev['merged-' + mitem.productId] || 0) + 1 })); }} disabled={loading} className="w-6 h-6 bg-white hover:bg-green-100 hover:text-green-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-gray-100">+</button>
                          <button onClick={() => { const vid = mitem.virtualId; if (editingPriceId === vid) { setEditingPriceId(null); } else { setEditingPriceId(vid); setPriceInputStr(String(localPriceEdits[mitem.productId] !== undefined ? localPriceEdits[mitem.productId] : mitem.unitPrice)); } }} className="w-7 h-7 bg-yellow-50 hover:bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600 text-[10px] font-bold transition-colors ml-0.5">✏️</button>
                          <button onClick={() => { setAddonItemsMap(prev => ({ ...prev, [mitem.virtualId]: { qty: (prev[mitem.virtualId]?.qty || 0) + 1, unitPrice: mitem.unitPrice, productId: mitem.productId, name: product?.name || '상품' } })); }} className="px-2 h-7 bg-purple-50 hover:bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-[10px] font-bold transition-colors ml-0.5">추가</button>
                        </div>
                      </div>
                      {isEditingPrice && (
                        <div className="px-4 pb-2.5 flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 shrink-0">추가 단가 수정:</span>
                          <input
                            type="number"
                            value={priceInputStr}
                            onChange={e => setPriceInputStr(e.target.value)}
                            className="flex-1 text-xs border border-yellow-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            placeholder="단가 입력"
                          />
                          <span className="text-[10px] text-gray-400 shrink-0">VND</span>
                          <button onClick={() => {
                            const val = priceInputStr === '' ? 0 : Math.max(0, Number(priceInputStr) || 0);
                            setLocalPriceEdits(prev => ({ ...prev, [mitem.productId]: val }));
                            setEditingPriceId(null);
                          }}
                            className="text-[10px] text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded-lg font-bold shrink-0">확인</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 추가 주문 완료 (정상가격 추가주문) - 조리완료 합산 제외, 별도 카드 */}
          {addonNormalCompletedOrders.length > 0 && addonNormalCompletedOrders.map(order => {
            const items = allOrderItems.filter(i => i.order_id === order.id);
            if (items.length === 0) return null;
            const orderTime = new Date(order.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={order.id} className='bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden'>
                <div className='px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <span className='w-2 h-2 bg-green-400 rounded-full'></span>
                    <span className='text-sm font-bold text-green-700'>추가 주문 완료</span>
                    <span className='text-xs text-green-400'>{orderTime}</span>
                  </div>
                  <span className='text-xs text-green-600'>
                    {items.reduce((s, i) => { const up = i.unit_price || (i.quantity > 0 ? i.price / i.quantity : i.price); return s + up * i.quantity; }, 0).toLocaleString()} VND
                  </span>
                </div>
                <div>
                  {items.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
                    return (
                      <div key={item.id} className='flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 px-4'>
                        <div className='w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'>
                          {product?.image_url ? <img src={product.image_url} alt='' className='w-full h-full object-contain' /> : <span className='text-[8px] text-gray-300'>-</span>}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <p className='text-xs font-medium text-[#374151] truncate'>{product?.name || '상품'}</p>
                          <p className='text-[10px] text-gray-400'>공급가 {unitPrice.toLocaleString()} VND</p>
                        </div>
                        <span className='text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded flex-shrink-0'>{item.quantity}개</span>
                        <button onClick={() => { if (editingPriceId === item.id) { setEditingPriceId(null); } else { setEditingPriceId(item.id); setPriceInputStr(String(unitPrice)); } }} className='w-7 h-7 bg-yellow-50 hover:bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600 text-[10px] font-bold transition-colors'>✏️</button>
                        {editingPriceId === item.id && (
                          <div className='flex items-center gap-1 px-4 pb-2'>
                            <input type='number' value={priceInputStr} onChange={e => setPriceInputStr(e.target.value)} className='flex-1 px-2 py-1 border border-yellow-300 rounded text-xs' />
                            <button onClick={() => { setLocalPriceEdits(prev => ({ ...prev, [item.product_id]: Number(priceInputStr) })); setEditingPriceId(null); setTimeout(() => submitOrderEdits(), 0); }} className='text-[10px] text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded-lg font-bold'>확인</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* 추가 서비스 조리완료 */}
          {serviceCompletedOrders.length > 0 && serviceCompletedOrders.map(order => {
            const items = allOrderItems.filter(i => i.order_id === order.id);
            if (items.length === 0) return null;
            const orderTime = new Date(order.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                    <span className="text-sm font-bold text-purple-700">추가 서비스</span>
                    <span className="text-xs text-purple-400">{orderTime}</span>
                  </div>
                  <span className="text-xs text-purple-500">
                    {items.reduce((s, i) => {
                      const up = i.unit_price || (i.quantity > 0 ? i.price / i.quantity : i.price);
                      const product = products.find(p => p.id === i.product_id);
                      const taxRate = product?.tax_rate ?? 0.1;
                      return s + up * i.quantity;
                    }, 0).toLocaleString()} VND
                  </span>
                </div>
                <div>
                  {items.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 px-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-gray-300">-</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#374151] truncate">{product?.name || '상품'}</p>
                          <p className="text-[10px] text-gray-400">공급가 {unitPrice.toLocaleString()} VND</p>
                        </div>
                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded flex-shrink-0">{item.quantity}개</span>
                        <button onClick={() => { if (editingPriceId === item.id) { setEditingPriceId(null); } else { setEditingPriceId(item.id); setPriceInputStr(String(unitPrice)); } }} className='w-7 h-7 bg-yellow-50 hover:bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600 text-[10px] font-bold transition-colors'>✏️</button>
                        {editingPriceId === item.id && (
                          <div className='flex items-center gap-1 px-4 pb-2'>
                            <input type='number' value={priceInputStr} onChange={e => setPriceInputStr(e.target.value)} className='flex-1 px-2 py-1 border border-yellow-300 rounded text-xs' />
                            <button onClick={() => { setLocalPriceEdits(prev => ({ ...prev, [item.product_id]: Number(priceInputStr) })); setEditingPriceId(null); setTimeout(() => submitOrderEdits(), 0); }} className='text-[10px] text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded-lg font-bold'>확인</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </main>

        {/* 하단 고정 버튼 영역 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 py-3 flex gap-1.5 shadow-lg z-30">
          <div className="flex items-center justify-between px-2 min-w-0 flex-1">
            <span className="text-sm text-gray-600 shrink-0">공급가액</span>
            <span className="text-base font-bold text-blue-600 ml-1">{Math.round(displaySupplyTotal).toLocaleString()} VND</span>
          </div>
          <button onClick={() => issueReceipt()}
            className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors shrink-0">
            가영수증
          </button>
          <button onClick={submitOrderEdits}
            disabled={(Object.keys(localQtyEdits).filter(k => localQtyEdits[k] !== 0).length === 0 && Object.keys(addonItemsMap).length === 0) || loading}
            className="px-3 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors shrink-0">
            주문하기
          </button>
          <button onClick={() => { setPendingOrders(tableOrders); setShowPaymentModal(true); }}
            disabled={tableOrders.length === 0}
            className="px-3 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors shrink-0">
            결제
          </button>
        </div>

        {/* 우하단 고정 + 버튼 (추가 주문) */}
        <button onClick={() => navigateTo('menu')}
          className="fixed bottom-20 right-4 lg:right-6 w-12 h-12 lg:w-14 lg:h-14 bg-[#1F2937] hover:bg-[#111827] text-white text-2xl rounded-full shadow-xl hover:scale-105 transition-all flex items-center justify-center z-40">+</button>

        {/* 결제 수단 모달 */}
        {showPaymentModal && (() => {
          const payTotal = Math.round(pendingOrders.reduce((s, order) => {
            return s + allOrderItems.filter(i => i.order_id === order.id).reduce((sum, item) => {
              const up = localPriceEdits[item.product_id] !== undefined
                ? localPriceEdits[item.product_id]
                : (item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price));
              const product = products.find(p => p.id === item.product_id);
              const taxRate = product?.tax_rate ?? 0.1;
              return sum + up * item.quantity;
            }, 0);
          }, 0));
          const hasBankInfo = settings.bank_name || settings.account_number;
          const qrValue = hasBankInfo
            ? `${settings.receipt_header || 'POS'}\n은행: ${settings.bank_name}\n계좌: ${settings.account_number}\n예금주: ${settings.account_holder}\n금액: ${payTotal.toLocaleString()} VND`
            : '';
          return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {showTransferQR ? (
                  <>
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                      <button onClick={() => setShowTransferQR(false)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <div>
                        <h3 className="text-lg font-bold text-[#111827]">계좌이체 결제</h3>
                        <p className="text-sm text-gray-400">Table {selectedTable} · {payTotal.toLocaleString()} VND</p>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      {hasBankInfo ? (
                        <div className="flex items-start gap-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <div className="bg-white p-2 rounded-lg border border-blue-200 flex-shrink-0">
                            <QRCodeSVG value={qrValue || ' '} size={76} level="M" />
                          </div>
                          <div className="space-y-2 flex-1">
                            <div>
                              <p className="text-[10px] text-blue-400 uppercase">은행</p>
                              <p className="text-sm font-bold text-[#1F2937]">{settings.bank_name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-400 uppercase">계좌번호</p>
                              <p className="text-sm font-bold text-[#1F2937] tracking-wider">{settings.account_number}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-400 uppercase">예금주</p>
                              <p className="text-sm font-semibold text-[#1F2937]">{settings.account_holder}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
                          <p className="text-sm text-amber-600">관리자 설정에서 은행정보를 먼저 입력해주세요.</p>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400">이체 금액</p>
                        <p className="text-xl font-bold text-blue-600">{payTotal.toLocaleString()} VND</p>
                      </div>
                    </div>
                    <div className="px-5 pb-5 space-y-2">
                      <button onClick={() => { setShowTransferQR(false); completePayment('transfer'); }}
                        disabled={!hasBankInfo}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors">
                        이체 완료 · 결제 처리
                      </button>
                      <button onClick={() => setShowTransferQR(false)}
                        className="w-full py-2 text-gray-400 hover:text-[#374151] text-sm font-medium">뒤로</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="px-6 py-5 border-b border-gray-100">
                      <h3 className="text-lg font-bold text-[#111827]">결제 수단</h3>
                      <p className="text-sm text-gray-400">Table {selectedTable} · {payTotal.toLocaleString()} VND</p>
                    </div>
                    <div className="p-4 space-y-2">
                      {[
                        { key: 'cash', icon: '💵', name: '현금', sub: 'Cash' },
                        { key: 'card', icon: '💳', name: '카드', sub: 'Card' },
                        { key: 'transfer', icon: '🏦', name: '계좌이체', sub: 'Bank Transfer · QR' },
                      ].map(m => (
                        <button key={m.key}
                          onClick={() => { if (m.key === 'transfer') { setShowTransferQR(true); } else { completePayment(m.key); } }}
                          className="w-full flex items-center gap-4 bg-gray-50 hover:bg-gray-100 p-4 rounded-xl transition-colors text-left">
                          <span className="text-2xl">{m.icon}</span>
                          <div>
                            <p className="font-semibold text-[#111827]">{m.name}</p>
                            <p className="text-xs text-gray-400">{m.sub}</p>
                          </div>
                          {m.key === 'transfer' && hasBankInfo && (
                            <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">QR</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-gray-100">
                      <button onClick={() => { setShowPaymentModal(false); setShowTransferQR(false); setPendingOrders([]); }}
                        className="w-full text-gray-400 hover:text-[#374151] py-2 text-sm font-medium">취소</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* 가영수증 모달 */}
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          orders={tableOrders}
          orderItems={allOrderItems}
          products={products}
          tableNumber={selectedTable!}
          settings={settings}
          localPriceEdits={localPriceEdits}
        />

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
            <button onClick={() => navigateTo('orders')} className="text-xs lg:text-sm text-blue-500 font-medium px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
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
                className={'px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-medium whitespace-nowrap transition-all ' +
                  (selectedCategory === cat ? 'bg-[#1F2937] text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50')}>
                {cat === 'all' ? '전체' : cat}
              </button>
            ))}
          </div>
        </header>

        {/* ===== 모바일 전용: 선택 메뉴 목록 (헤더 바로 아래 고정) ===== */}
        {cart.length > 0 && (
          <div className="lg:hidden bg-white border-b border-blue-100 px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-blue-700">선택 메뉴 {cart.reduce((s, i) => s + i.quantity, 0)}개</span>
              <span className="text-xs font-bold text-blue-700">{cartSubtotal.toLocaleString()} VND</span>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="border border-blue-100 rounded-xl bg-blue-50 px-2.5 py-1.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-blue-100">
                      {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-gray-300">-</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#374151] truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{(item.price * item.quantity).toLocaleString()} VND</p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {editingQuantityId === item.id ? (
                        <input
                          type="number"
                          value={quantityInput}
                          onChange={e => setQuantityInput(e.target.value)}
                          onFocus={e => e.target.select()}
                          onBlur={() => saveQuantity(item.id)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') cancelEditing(); }}
                          className="w-14 h-6 text-center text-xs border-2 border-blue-400 rounded-lg focus:outline-none font-bold bg-white"
                          autoFocus
                          min="1"
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            disabled={loading || item.quantity <= 0}
                            className="w-6 h-6 bg-white hover:bg-red-100 hover:text-red-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-blue-100">
                            −
                          </button>
                          <button
                            onClick={() => startEditingQuantity(item.id, item.quantity)}
                            className="w-8 h-6 bg-white hover:bg-blue-100 border border-blue-200 rounded-md flex items-center justify-center font-bold text-blue-700 text-xs transition-colors">
                            {item.quantity}
                          </button>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={loading}
                            className="w-6 h-6 bg-white hover:bg-blue-100 hover:text-blue-600 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-blue-100">
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-6 h-6 bg-red-50 hover:bg-red-100 rounded-md flex items-center justify-center text-red-400 text-[10px] ml-0.5 transition-colors">
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <input type="text" placeholder="📝 주방 메모"
                    value={cartMemos[item.id] || ''}
                    onChange={e => setCartMemos(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-full text-[10px] px-2 py-1 bg-white border border-blue-100 rounded-lg text-blue-700 placeholder-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">로딩 중...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 lg:gap-3">
              {filteredProducts.map(product => (
                <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0}
                  className={'bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden text-left ' +
                    (product.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5')}>
                  <div className="w-full aspect-square bg-gray-50 flex items-center justify-center p-2 lg:p-3">
                    {product.image_url
                      ? <img src={product.image_url} alt="" className="w-full h-full object-contain" />
                      : <span className="text-xs text-gray-300">-</span>}
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

      {/* ===== 모바일 하단: 합계 + 주문하기 버튼만 ===== */}
      <div className="bg-white border-t border-gray-100 px-3 lg:hidden py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.06)] z-30">
        {cart.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-1">상품을 선택하세요</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-[#111827]">{cartSubtotal.toLocaleString()} <span className="text-xs font-normal text-gray-400">VND</span></p>
            <p className="text-[10px] text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)}개</p>
          </div>
          <button onClick={submitOrder} disabled={loading || cart.length === 0}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20">
            {loading ? '처리중...' : '주문하기'}
          </button>
        </div>
      </div>

      {/* ===== 오른쪽: 장바구니 - PC 사이드바 ===== */}
      <div className="hidden lg:block lg:w-80 xl:w-96">
        <div className="sticky top-0 h-screen bg-white border-l border-gray-100 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111827]">
              장바구니 <span className="text-sm font-normal text-gray-400">({cart.reduce((s, i) => s + i.quantity, 0)}개)</span>
            </h2>
            <button onClick={() => navigateTo('orders')} className="text-xs text-blue-500 hover:text-blue-600 font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
              주문내역
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 && (<p className="text-center text-xs text-gray-400 py-8">상품을 선택하세요</p>)}
            {cart.map(item => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image_url
                      ? <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                      : <span className="text-[8px] text-gray-300">-</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#374151] truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400">{item.price.toLocaleString()} VND</p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {editingQuantityId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={quantityInput}
                          onChange={e => setQuantityInput(e.target.value)}
                          onFocus={e => e.target.select()}
                          onBlur={() => saveQuantity(item.id)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') cancelEditing(); }}
                          className="w-14 h-7 text-center text-xs border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-bold"
                          autoFocus
                          min="1"
                        />
                      </div>
                    ) : (
                      <>
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 bg-white hover:bg-red-100 hover:text-red-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-sm transition-colors border border-gray-100">−</button>
                        <button onClick={() => startEditingQuantity(item.id, item.quantity)} className="w-9 h-7 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md flex items-center justify-center font-bold text-blue-700 text-sm transition-colors">{item.quantity}</button>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 bg-white hover:bg-blue-100 hover:text-blue-600 rounded-md flex items-center justify-center font-bold text-gray-500 text-sm transition-colors border border-gray-100">+</button>
                        <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 bg-red-50 hover:bg-red-100 rounded-md flex items-center justify-center text-red-400 text-xs ml-0.5 transition-colors">✕</button>
                      </>
                    )}
                  </div>
                </div>
                <input type="text" placeholder="📝 주방 메모 (선택)"
                  value={cartMemos[item.id] || ''}
                  onChange={e => setCartMemos(prev => ({ ...prev, [item.id]: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 placeholder-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300" />
              </div>
            ))}
          </div>

          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-lg font-bold text-[#111827]">{cartSubtotal.toLocaleString()} <span className="text-xs font-normal text-gray-400">VND</span></p>
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
