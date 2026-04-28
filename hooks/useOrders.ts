'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import type { OrderData, OrderItemData, HistoryEntry } from '@/types';

export interface UseOrdersReturn {
  // 상태
  allOrders: OrderData[];
  allOrderItems: OrderItemData[];
  pendingOrders: OrderData[];
  localQtyEdits: Record<string, number>;
  localPriceEdits: Record<string, number>;
  localItemPriceEdits: Record<string, number>;
  addonItemsMap: Record<string, { qty: number; unitPrice: number; productId: string; name: string }>;
  addonOrderIds: string[];
  
  // 데이터 로드
  fetchOrders: () => Promise<void>;
  
  // 히스토리
  saveOrderHistory: (entry: HistoryEntry) => void;
  getOrderHistory: () => HistoryEntry[];
  formatHistoryTime: (timestamp: string) => string;
  
  // Setters
  setAllOrders: React.Dispatch<React.SetStateAction<OrderData[]>>;
  setAllOrderItems: React.Dispatch<React.SetStateAction<OrderItemData[]>>;
  setPendingOrders: React.Dispatch<React.SetStateAction<OrderData[]>>;
  setLocalQtyEdits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setLocalPriceEdits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setLocalItemPriceEdits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setAddonItemsMap: React.Dispatch<React.SetStateAction<Record<string, { qty: number; unitPrice: number; productId: string; name: string }>>>;
  setAddonOrderIds: React.Dispatch<React.SetStateAction<string[]>>;
  
  // 파생값
  tableOrderInfo: Record<string, { orders: OrderData[]; totalAmount: number }>;
  // 테이블 변경 시 초기화
  clearTableSpecificEdits: () => void;
}

export default function useOrders(): UseOrdersReturn {
  const [allOrders, setAllOrders] = useState<OrderData[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<OrderItemData[]>([]);
  const [pendingOrders, setPendingOrders] = useState<OrderData[]>([]);
  const [localQtyEdits, setLocalQtyEdits] = useState<Record<string, number>>({});
  const [localPriceEdits, setLocalPriceEdits] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('pos_price_edits') || '{}'); } catch { return {}; }
  });
  const [localItemPriceEdits, setLocalItemPriceEdits] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('pos_item_price_edits') || '{}'); } catch { return {}; }
  });
  const [addonItemsMap, setAddonItemsMap] = useState<Record<string, { qty: number; unitPrice: number; productId: string; name: string }>>({});
  const [addonOrderIds, setAddonOrderIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pos_addon_order_ids') || '[]'); } catch { return []; }
  });

  // localStorage 지속성
  useEffect(() => {
    localStorage.setItem('pos_price_edits', JSON.stringify(localPriceEdits));
  }, [localPriceEdits]);

  useEffect(() => {
    localStorage.setItem('pos_item_price_edits', JSON.stringify(localItemPriceEdits));
  }, [localItemPriceEdits]);

  // 테이블별 주문 정보
  const tableOrderInfo = useMemo(() => {
    const info: Record<string, { orders: OrderData[]; totalAmount: number }> = {};
    allOrders.filter(o => ['pending', 'completed'].includes(o.status)).forEach(o => {
      const key = String(o.table_id).replace(/\D/g, '');
      if (!info[key]) info[key] = { orders: [], totalAmount: 0 };
      info[key].orders.push(o);
      const total = o.total_amount !== undefined ? o.total_amount : o.total;
      info[key].totalAmount += total;
    });
    return info;
  }, [allOrders]);

  const fetchOrders = useCallback(async () => {
    const supabase = getSupabase();
    const { data: orders, error: ordErr } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: items, error: itErr } = await supabase.from('order_items').select('*').order('created_at', { ascending: false });
    if (ordErr || itErr) {
      console.error('Failed to fetch orders:', ordErr || itErr);
      return;
    }
    setAllOrders(orders || []);
    setAllOrderItems(items || []);
  }, []);

  // 히스토리 localStorage
  const saveOrderHistory = useCallback((entry: HistoryEntry) => {
    try {
      const history = JSON.parse(localStorage.getItem('pos_order_history') || '[]') as HistoryEntry[];
      history.unshift(entry);
      const limited = history.slice(0, 100);
      localStorage.setItem('pos_order_history', JSON.stringify(limited));
    } catch (e) {
      console.error('Failed to save order history:', e);
    }
  }, []);

  const getOrderHistory = useCallback((): HistoryEntry[] => {
    try {
      return JSON.parse(localStorage.getItem('pos_order_history') || '[]') as HistoryEntry[];
    } catch {
      return [];
    }
  }, []);

  const formatHistoryTime = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const clearTableSpecificEdits = useCallback(() => {
    setLocalPriceEdits({});
    setLocalItemPriceEdits({});
    // localStorage는 useEffect에서 자동 동기화됨
  }, [setLocalPriceEdits, setLocalItemPriceEdits]);

  return {
    allOrders,
    allOrderItems,
    pendingOrders,
    localQtyEdits,
    localPriceEdits,
    localItemPriceEdits,
    addonItemsMap,
    addonOrderIds,
    fetchOrders,
    saveOrderHistory,
    getOrderHistory,
    formatHistoryTime,
    setAllOrders,
    setAllOrderItems,
    setPendingOrders,
    setLocalQtyEdits,
    setLocalPriceEdits,
    setLocalItemPriceEdits,
    setAddonItemsMap,
    setAddonOrderIds,
    tableOrderInfo,
    clearTableSpecificEdits,
  };
}
