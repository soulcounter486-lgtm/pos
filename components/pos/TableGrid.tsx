'use client';

import React from 'react';
import type { OrderData, OrderItemData, Product } from '@/types';

interface Table {
  id: string;
  name: string;
  status: string;
}

interface TableGridProps {
  tables: Table[];
  allOrders: OrderData[];
  allOrderItems: OrderItemData[];
  products: Product[];
  selectedTable: string | null;
  mergedTables: string[];
  isMergeMode: boolean;
  isPC: boolean;
  currentView: string;
  localPriceEdits: Record<string, number>;
  locale?: string;
  t?: (key: string) => string;
  onTableClick: (tableId: string, view: 'orders' | 'menu') => void;
  onToggleMerge: (tableNum: string) => void;
  onViewMerged: () => void;
}

export default function TableGrid({
  tables,
  allOrders,
  allOrderItems,
  products,
  selectedTable,
  mergedTables,
  isMergeMode,
  isPC,
  currentView,
  localPriceEdits,
  locale,
  t,
  onTableClick,
  onToggleMerge,
  onViewMerged,
}: TableGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
      {tables
        .sort((a, b) => {
          const aNum = parseInt(a.name.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.name.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        })
        .map(table => {
          const ts = table.name.replace(/\D/g, '');
          const tableUuid = table.id;
          const tableOrders = allOrders.filter(o => String(o.table_id) === String(tableUuid));
          const hasPendingOrders = tableOrders.some(o => o.status === 'pending');
          const hasCompletedOrders = tableOrders.some(o => o.status === 'completed') && !hasPendingOrders;
          const total = tableOrders.reduce((sum, order) => {
            return sum + allOrderItems
              .filter(i => i.order_id === order.id)
              .reduce((s, item) => {
                const isCompleted = order.status === 'completed';
                const up = isCompleted && localPriceEdits[item.product_id] !== undefined
                  ? localPriceEdits[item.product_id]
                  : (item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price));
                return s + up * item.quantity;
              }, 0);
          }, 0);
          const totalOrders = tableOrders.length;
          const pendingCount = tableOrders.filter(o => o.status === 'pending').length;
          const isMergeSelected = mergedTables.includes(ts);
          const isSplitSelected = isPC && !isMergeMode && selectedTable === ts.replace(/\D/g, '');

          const handleClick = () => {
            if (isMergeMode) {
              onToggleMerge(ts);
            } else if (isPC) {
              const tableNum = ts.replace(/\D/g, '');
              onTableClick(tableNum, 'orders');
            } else {
              const view = tableOrders.length > 0 ? 'orders' : 'menu';
              onTableClick(ts, view);
            }
          };

          return (
            <button
              key={table.id}
              onClick={handleClick}
              className={
                'relative bg-white rounded-2xl p-4 lg:p-5 border transition-all duration-200 text-left ' +
                (isMergeMode
                  ? isMergeSelected
                    ? 'border-purple-400 ring-2 ring-purple-300 shadow-md bg-purple-50'
                    : 'border-gray-100 hover:border-purple-200 hover:shadow-md'
                  : isSplitSelected
                  ? 'border-blue-400 ring-2 ring-blue-300 shadow-md bg-blue-50'
                  : hasCompletedOrders
                  ? 'border-green-200 hover:shadow-md hover:-translate-y-0.5'
                  : hasPendingOrders
                  ? 'border-red-200 hover:shadow-md hover:-translate-y-0.5'
                  : 'border-gray-100 hover:shadow-md hover:-translate-y-0.5')
              }
            >
              {isMergeMode ? (
                <div
                  className={
                    'absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ' +
                    (isMergeSelected ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-400')
                  }
                >
                  {isMergeSelected ? '✓' : ''}
                </div>
              ) : (
                <div
                  className={
                    'absolute top-3 right-3 w-3 h-3 rounded-full ' +
                    (hasCompletedOrders
                      ? 'bg-green-400'
                      : hasPendingOrders
                      ? 'bg-red-400 animate-pulse'
                      : 'bg-gray-300')
                  }
                ></div>
              )}
              <div className="text-base lg:text-lg font-medium mb-2 text-[#111827]">
                {t ? t('common.table') : 'Table'} {table.name}
              </div>
              <div
                className={
                  'text-xs lg:text-sm font-medium mb-2 lg:mb-3 ' +
                  (isMergeMode && isMergeSelected
                    ? 'text-purple-600'
                    : hasCompletedOrders
                    ? 'text-green-500'
                    : hasPendingOrders
                    ? 'text-red-500'
                    : 'text-gray-500')
                }
              >
                {isMergeMode && isMergeSelected
                  ? (t ? t('common.merge_selected') : 'Selected')
                  : hasCompletedOrders
                  ? (t ? t('common.completed_short') : 'Completed')
                  : hasPendingOrders
                  ? (t ? t('common.pending_short') : 'Pending')
                  : (t ? t('common.available') : 'Available')}
              </div>
              {total > 0 && (
                <div className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 rounded-lg px-2 lg:px-3 py-1.5">
                  {(t ? t('common.supply_amount') : 'Subtotal')}{' '}
                  {total.toLocaleString()} VND
                </div>
              )}
              {totalOrders > 0 && (
                <div className="mt-2 flex gap-2">
                  <span className="text-[10px] lg:text-xs text-gray-400">
                    {totalOrders}{t ? t('common.order_count_unit') : ''}
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-[10px] lg:text-xs text-amber-500">
                      {pendingCount}{t ? t('common.order_count_unit') : ''} {t ? t('common.pending') : 'pending'}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
    </div>
  );
}
