'use client';

import React, { useMemo, Dispatch, SetStateAction } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

// Types
type Product = { id: string; name: string; category: string; price: number; barcode?: string; stock: number; image_url?: string; tax_rate?: number };
type CartItem = Product & { quantity: number };
type Table = { id: string; name: string; status: string };
type OrderData = { id: string; table_id: string; total: number; status: string; created_at: string; total_amount?: number; tax_amount?: number };
type OrderItemData = { id: string; order_id: string; product_id: string; quantity: number; price: number; unit_price?: number; status: string; note?: string };
type Settings = { bank_name: string; account_number: string; account_holder: string; receipt_header: string; staff_header_text: string };

type SplitOrdersPanelProps = {
  selectedTable: string | null;
  currentView: 'orders' | 'menu' | 'merged-orders';
  showReceiptModal: boolean;
  allOrders: OrderData[];
  allOrderItems: OrderItemData[];
  products: Product[];
  settings: Settings;
  localPriceEdits: Record<string, number>;
  localItemPriceEdits: Record<string, number>;
  localQtyEdits: Record<string, number>;
  addonItemsMap: Record<string, { qty: number; unitPrice: number; productId: string; name: string }>;
  addonOrderIds: string[];
  editingPriceId: string | null;
  priceInputStr: string;
  loading: boolean;
  cart: CartItem[];
  pcHasEdits: boolean;
  setShowReceiptModal: Dispatch<SetStateAction<boolean>>;
  setPendingOrders: Dispatch<SetStateAction<OrderData[]>>;
  setShowPaymentModal: Dispatch<SetStateAction<boolean>>;
  setHistoryTableFilter: Dispatch<SetStateAction<string | null>>;
  setExpandedHistoryId: Dispatch<SetStateAction<string | null>>;
  setHistoryTick: Dispatch<SetStateAction<number>>;
  setShowHistory: Dispatch<SetStateAction<boolean>>;
  setCurrentView: Dispatch<SetStateAction<'orders' | 'menu' | 'merged-orders'>>;
  setSelectedTable: Dispatch<SetStateAction<string | null>>;
  setLocalPriceEdits: Dispatch<SetStateAction<Record<string, number>>>;
  setLocalItemPriceEdits: Dispatch<SetStateAction<Record<string, number>>>;
  setLocalQtyEdits: Dispatch<SetStateAction<Record<string, number>>>;
  setEditingPriceId: Dispatch<SetStateAction<string | null>>;
  setPriceInputStr: Dispatch<SetStateAction<string>>;
  setAddonItemsMap: Dispatch<SetStateAction<Record<string, { qty: number; unitPrice: number; productId: string; name: string }>>>;
  submitOrderEdits: () => Promise<void>;
  updateOrderItemQuantity: (itemId: string, orderId: string, delta: number) => Promise<void>;
  goBack: () => void;
  splitTableUuid?: string | null;
  tables?: Array<{ id: string; name: string }>;
};

export default function SplitOrdersPanel(props: SplitOrdersPanelProps) {
  const { t } = useLanguage();
  const {
    selectedTable,
    currentView,
    showReceiptModal,
    allOrders,
    allOrderItems,
    products,
    settings,
    localPriceEdits,
    localItemPriceEdits,
    localQtyEdits,
    addonItemsMap,
    addonOrderIds,
    editingPriceId,
    priceInputStr,
    loading,
    cart,
    pcHasEdits,
    setShowReceiptModal,
    setPendingOrders,
    setShowPaymentModal,
    setHistoryTableFilter,
    setExpandedHistoryId,
    setHistoryTick,
    setShowHistory,
    setCurrentView,
    setSelectedTable,
    setLocalPriceEdits,
    setLocalItemPriceEdits,
    setLocalQtyEdits,
    setEditingPriceId,
    setPriceInputStr,
    setAddonItemsMap,
    submitOrderEdits,
    updateOrderItemQuantity,
    goBack,
    splitTableUuid,
    tables = [],
  } = props;

  // Derived values (computed inside component to minimize props)
  const splitTableOrders = useMemo(() => {
    if (!splitTableUuid) return [];
    return allOrders.filter(
      o => String(o.table_id) === String(splitTableUuid) && (o.status === 'pending' || o.status === 'completed')
    );
  }, [allOrders, splitTableUuid]);

  const splitPending = useMemo(() => splitTableOrders.filter(o => o.status === 'pending'), [splitTableOrders]);
  const splitCompleted = useMemo(() => splitTableOrders.filter(o => o.status === 'completed'), [splitTableOrders]);

  const computeSplitOrderTotal = (order: OrderData) =>
    allOrderItems.filter(i => i.order_id === order.id).reduce((s, item) => {
      const isCompleted = order.status === 'completed';
      const up = isCompleted
        ? localItemPriceEdits[item.id] !== undefined
          ? localItemPriceEdits[item.id]
          : localPriceEdits[item.product_id] !== undefined
            ? localPriceEdits[item.product_id]
            : item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price)
        : item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
      return s + up * item.quantity;
    }, 0);

  const splitPendingTotal = useMemo(() => splitPending.reduce((s, o) => s + computeSplitOrderTotal(o), 0), [splitPending, allOrderItems, localPriceEdits, localItemPriceEdits]);
  const splitCompletedTotal = useMemo(() => splitCompleted.reduce((s, o) => s + computeSplitOrderTotal(o), 0), [splitCompleted, allOrderItems, localPriceEdits, localItemPriceEdits]);
  const splitTotal = useMemo(() => splitPendingTotal + splitCompletedTotal, [splitPendingTotal, splitCompletedTotal]);

  // PC 우측패널용 풍부한 주문상세 데이터
  const pcBaseCompletedOrders = useMemo(() => splitCompleted.filter(o => !addonOrderIds.includes(o.id)), [splitCompleted, addonOrderIds]);
  const pcAddonCompletedOrders = useMemo(() => splitCompleted.filter(o => addonOrderIds.includes(o.id)), [splitCompleted, addonOrderIds]);
  const pcServiceCompletedOrders = useMemo(() => {
    return pcAddonCompletedOrders.filter(o => {
      const items = allOrderItems.filter(i => i.order_id === o.id);
      return items.length > 0 && items.every(i => {
        if (localItemPriceEdits[i.id] !== undefined) return localItemPriceEdits[i.id] === 0;
        return i.price === 0;
      });
    });
  }, [pcAddonCompletedOrders, allOrderItems, localItemPriceEdits]);
  const pcAddonNormalCompletedOrders = useMemo(() =>
    pcAddonCompletedOrders.filter(o => !pcServiceCompletedOrders.map(s => s.id).includes(o.id)),
    [pcAddonCompletedOrders, pcServiceCompletedOrders]
  );
  const pcMergedCompletedItems = useMemo(() => {
    const map = new Map<string, { virtualId: string; productId: string; totalQty: number; unitPrice: number; notes: string[] }>();
    pcBaseCompletedOrders.forEach(order => {
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
  }, [pcBaseCompletedOrders, allOrderItems]);

  // renderOrderItem: individual item rendering
  const renderOrderItem = (order: OrderData, item: any, editable: boolean, deferred = false) => {
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
            {product?.name || t('common.product_label')}
            {supplyAmount === 0 && <span className="ml-1 text-[9px] font-bold text-pink-600 bg-pink-50 border border-pink-200 px-1 py-0.5 rounded">{t('common.service')}</span>}
          </p>
          {supplyAmount === 0
            ? <p className="text-[10px] text-pink-500 font-medium">{t('common.service_provide_label')} (0 VND)</p>
            : <p className="text-[10px] text-gray-400">{t('common.supply_amount')} {supplyAmount.toLocaleString()} VND</p>}
          {item.note && <p className="text-[10px] text-blue-500 mt-0.5 bg-blue-50 px-1.5 py-0.5 rounded inline-block">📝 {item.note}</p>}
          {!itemDone && deferred && localDelta !== 0 && (
            <p className={"text-[10px] mt-0.5 font-bold " + (localDelta > 0 ? 'text-green-600' : localDelta < 0 ? 'text-red-500' : 'text-[#111827]')}>
              {localDelta > 0 ? t('common.qty_add_planned', { qty: localDelta }) : t('common.qty_cancel_planned', { qty: Math.abs(localDelta) })}
            </p>
          )}
        </div>
        {itemDone ? (
          <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">✅ {t('common.status_completed')}</span>
        ) : editable ? (
          deferred ? (
            <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
              <button onClick={() => { const curr = localQtyEdits[item.id] || 0; const next = Math.max(-item.quantity, curr - 1); setLocalQtyEdits(prev => ({ ...prev, [item.id]: next })); }}
                disabled={loading || displayQty <= 0}
                className="w-7 h-7 bg-white hover:bg-red-100 hover:text-red-500 rounded-lg flex items-center justify-center text-red-400 text-sm font-bold disabled:opacity-40 transition-colors">−</button>
              <span className={`w-7 text-center text-xs font-bold ${localDelta > 0 ? 'text-green-600' : localDelta < 0 ? 'text-red-500' : 'text-[#111827]'}`}>{displayQty}</span>
              <button onClick={() => setLocalQtyEdits(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
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
          <span className="text-xs font-bold text-[#374151] bg-gray-100 px-2 py-1 rounded flex-shrink-0 mt-0.5">{item.quantity}{t("common.order_count_unit_label")}</span>
        )}
      </div>
    );
  };

  // renderOrdersDetailContent: main content area
  const renderOrdersDetailContent = () => {
    return (
      <>
        {/* 대기 중인 주문 */}
        {splitPending.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                <span className="text-sm font-bold text-amber-700">{t('common.status_pending')}</span>
                <span className="text-xs text-amber-500">{splitPending.length}{t('common.order_count_unit_label')}</span>
              </div>
              <span className="text-sm font-bold text-amber-600">{Math.round(splitPendingTotal).toLocaleString()} VND</span>
            </div>
            <div>
              {splitPending.flatMap(order => allOrderItems.filter(i => i.order_id === order.id).map(item => renderOrderItem(order, item, true, false)))}
            </div>
          </div>
        )}

        {/* {t("common.completed_orders_label")} (product_id 합산) */}
        {pcMergedCompletedItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
            <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="text-sm font-bold text-green-700">{t("common.status_completed")}</span>
                <span className="text-xs text-green-500">{pcMergedCompletedItems.length}{t("common.item_count_unit_label")}</span>
              </div>
              <span className="text-xs text-green-500">{t("common.edit_qty_then_order_label")}</span>
            </div>
            <div>
              {pcMergedCompletedItems.map(mitem => {
                const product = products.find(p => p.id === mitem.productId);
                const localDelta = localQtyEdits[mitem.virtualId] || 0;
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
                        <p className="text-xs font-medium text-[#374151] truncate">{product?.name || t('common.product_label')}</p>
                        <p className="text-[10px] text-gray-400">{t('common.supply_amount')} {supplyAmount.toLocaleString()} VND</p>
                        {mitem.notes.length > 0 && (
                          <p className="text-[10px] text-blue-500 mt-0.5 bg-blue-50 px-1.5 py-0.5 rounded inline-block">📝 {mitem.notes.join(', ')}</p>
                        )}
                        {localDelta !== 0 && (
                          <p className={`text-[10px] mt-0.5 font-bold ${localDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {localDelta > 0 ? '▲ +' + localDelta + '개 추가 예정' : '▼ ' + localDelta + '개 취소 예정'}
                          </p>
                        )}
                        {addonEntry && (
                          <p className="text-[10px] mt-0.5 font-bold text-purple-600">✨ {t("common.add")}{addonEntry.qty}{t("common.order_count_unit_label")} · {(editedPrice * addonEntry.qty).toLocaleString()} VND</p>
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
                        <input type="number" value={priceInputStr} onChange={e => setPriceInputStr(e.target.value)} className="flex-1 text-xs border border-yellow-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-400" placeholder="단가 입력" />
                        <span className="text-[10px] text-gray-400 shrink-0">VND</span>
                        <button onClick={() => { const val = priceInputStr === '' ? 0 : Math.max(0, Number(priceInputStr) || 0); setLocalPriceEdits(prev => ({ ...prev, [mitem.productId]: val })); setEditingPriceId(null); }} className="text-[10px] text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded-lg font-bold shrink-0">확인</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 추가 주문 완료 */}
        {pcAddonNormalCompletedOrders.map(order => {
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
                <span className='text-xs text-green-600'>{items.reduce((s, i) => { const up = i.unit_price || (i.quantity > 0 ? i.price / i.quantity : i.price); return s + up * i.quantity; }, 0).toLocaleString()} VND</span>
              </div>
              <div>
                {items.map(item => {
                  const product = products.find(p => p.id === item.product_id);
                  const baseUnit = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
                  const unitPrice = localItemPriceEdits[item.id] !== undefined ? localItemPriceEdits[item.id] : baseUnit;
                  return (
                    <div key={item.id} className='border-b border-gray-50 last:border-0'>
                      <div className='flex items-center gap-2 py-2.5 px-4'>
                        <div className='w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'>
                          {product?.image_url ? <img src={product.image_url} alt='' className='w-full h-full object-contain' /> : <span className='text-[8px] text-gray-300'>-</span>}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <p className='text-xs font-medium text-[#374151] truncate'>{product?.name || '상품'}</p>
                          <p className='text-[10px] text-gray-400'>{t('common.supply_amount')} {unitPrice.toLocaleString()} VND</p>
                        </div>
                        <span className='text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded flex-shrink-0'>{item.quantity}개</span>
                        <button onClick={() => { if (editingPriceId === item.id) { setEditingPriceId(null); } else { setEditingPriceId(item.id); setPriceInputStr(String(unitPrice)); } }} className='w-7 h-7 bg-yellow-50 hover:bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600 text-[10px] font-bold transition-colors flex-shrink-0'>✏️</button>
                      </div>
                      {editingPriceId === item.id && (
                        <div className='flex items-center gap-1 px-4 pb-2'>
                          <input type='number' value={priceInputStr} onChange={e => setPriceInputStr(e.target.value)} className='flex-1 min-w-0 px-2 py-1 border border-yellow-300 rounded text-xs' />
                          <button onClick={() => { setLocalItemPriceEdits(prev => ({ ...prev, [item.id]: Number(priceInputStr) })); setEditingPriceId(null); setTimeout(() => submitOrderEdits(), 0); }} className='text-[10px] text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded-lg font-bold flex-shrink-0'>확인</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* 추가 서비스 (0원) */}
        {pcServiceCompletedOrders.map(order => {
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
                <span className="text-xs text-purple-500">서비스 (0 VND)</span>
              </div>
              <div>
                {items.map(item => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={item.id} className="flex items-center gap-2 py-2.5 px-4 border-b border-gray-50 last:border-0">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-gray-300">-</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#374151] truncate">{product?.name || '상품'}</p>
                        <p className="text-[10px] text-pink-500 font-medium">서비스 제공</p>
                      </div>
                      <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded flex-shrink-0">{item.quantity}개</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {splitTableOrders.length === 0 && (
          <div className="text-center py-12 text-gray-300 text-sm">아직 주문이 없습니다</div>
        )}
      </>
    );
  };

  // Main renderSplitOrdersPanel
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-96 xl:w-[420px] lg:h-full border-l border-gray-200 bg-white overflow-hidden flex-shrink-0">
      {!selectedTable ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
          <div className="text-5xl mb-4">👈</div>
          <p className="text-base font-semibold text-gray-500">테이블을 선택하세요</p>
          <p className="text-xs text-gray-400 mt-2">선택 시 주문 내역이 여기에 표시됩니다</p>
        </div>
      ) : (
        <>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#111827]">Table {selectedTable}</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {splitTableOrders.length === 0 ? '주문 없음' : `${splitTableOrders.length}건 · ${Math.round(splitTotal).toLocaleString()} VND`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => { setHistoryTableFilter(selectedTable); setExpandedHistoryId(null); setHistoryTick(t => t + 1); setShowHistory(true); }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100">
                📋 히스토리
              </button>
              <button onClick={goBack} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded">✕</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-[#F8F9FA]">
            {renderOrdersDetailContent()}
          </div>
          {/* 하단 고정 액션 영역 (스크롤 X) */}
          <div className="relative border-t border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={() => setCurrentView(currentView === 'menu' ? 'orders' : 'menu')}
              className={'absolute -top-16 right-4 w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-xl text-white transition-all ring-4 ring-white ' +
                (currentView === 'menu' ? 'bg-gray-700 hover:bg-gray-800' : 'bg-blue-500 hover:bg-blue-600')}
              title={currentView === 'menu' ? '메뉴 닫기' : '메뉴 열기'}>
              {currentView === 'menu' ? '✕' : '+'}
            </button>
            <div className="p-3 grid grid-cols-3 gap-2">
              <button onClick={() => setShowReceiptModal(true)}
                disabled={splitTableOrders.length === 0}
                className="py-3 rounded-xl bg-white border border-amber-300 hover:bg-amber-50 disabled:opacity-40 text-xs font-bold text-amber-700">
                🧾 가영수증
              </button>
              <button onClick={() => { if (cart.length > 0) { /* submitOrder handled by parent */ } else if (pcHasEdits) { submitOrderEdits(); } }}
                disabled={loading || (cart.length === 0 && !pcHasEdits)}
                className="py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-400 text-white text-xs font-bold shadow">
                {loading ? '처리중' : (cart.length > 0
                  ? `🛒 주문하기 (${cart.reduce((s, i) => s + i.quantity, 0)})`
                  : pcHasEdits ? '🛒 변경 반영' : '🛒 주문하기')}
              </button>
              <button onClick={() => { setPendingOrders(splitTableOrders); setShowPaymentModal(true); }}
                disabled={splitTableOrders.length === 0}
                className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold shadow">
                💳 결제하기
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
