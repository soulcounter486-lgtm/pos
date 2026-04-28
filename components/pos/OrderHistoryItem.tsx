'use client';

import { memo } from 'react';
import type { HistoryEntry } from '@/types';
import { useLanguage } from '@/components/LanguageProvider';

interface OrderHistoryItemProps {
  entry: HistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

export default memo(function OrderHistoryItem({ entry, isExpanded, onToggle }: OrderHistoryItemProps) {
  const { t } = useLanguage();

  return (
    <div className="border-b border-gray-100">
      {/* Header (always displayed) */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold bg-[#1F2937] text-white px-2 py-0.5 rounded">
              Table {entry.tableNumber}
            </span>
            {entry.type === 'edit' && (
              <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                {t('common.additional_service')}
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              {new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {entry.items.map(i => i.name + ' ×' + i.quantity).join(', ')}
          </p>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <p className="text-sm font-bold text-blue-600">{entry.totalAmount.toLocaleString()} VND</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{isExpanded ? '▲' : '▼'}</p>
        </div>
      </button>

      {/* Expanded order details */}
      {isExpanded && (
        <div className="px-4 pb-3 bg-gray-50">
          {entry.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-xs font-medium text-gray-700">{item.name}</p>
                <p className="text-[10px] text-gray-400">
                  {t('common.unit_price')} {item.unitPrice.toLocaleString()} VND × {item.quantity}
                </p>
              </div>
              <p className="text-xs font-bold text-gray-700">{item.totalPrice.toLocaleString()} VND</p>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-700">{t('common.total_sum')}</p>
            <p className="text-sm font-bold text-blue-600">{entry.totalAmount.toLocaleString()} VND</p>
          </div>
        </div>
      )}
    </div>
  );
});
