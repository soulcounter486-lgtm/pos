'use client';

import { memo } from 'react';
import type { HistoryEntry } from '@/types';
import { useLanguage } from '@/components/LanguageProvider';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  selectedTable: string | null;
  historyTableFilter: string | null;
  expandedHistoryId: string | null;
  showHistory: boolean;
  onClose: () => void;
  onFilterSelect: (tableId: string) => void;
  onFilterClear: () => void;
  onToggleExpand: (id: string) => void;
  formatHistoryTime: (timestamp: string) => string;
}

export default memo(function HistoryPanel({
  entries,
  selectedTable,
  historyTableFilter,
  expandedHistoryId,
  showHistory,
  onClose,
  onFilterSelect,
  onFilterClear,
  onToggleExpand,
  formatHistoryTime,
}: HistoryPanelProps) {
  const { t } = useLanguage();

  if (!showHistory) return null;

  // Filtered entries
  const filteredEntries = historyTableFilter
    ? entries.filter(e => String(e.tableNumber) === String(historyTableFilter))
    : entries;

  return (
    <>
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="bg-[#1F2937] px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold">📋 {t('common.history_btn')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {historyTableFilter
                ? t('common.history_filter', { table: historyTableFilter })
                : t('common.history_summary')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Table filter (when a table is selected) */}
        {selectedTable && (
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex gap-2 flex-shrink-0">
            <button
              onClick={() => onFilterSelect(selectedTable)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                historyTableFilter === selectedTable
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t('common.history_filter', { table: selectedTable })}
            </button>
            <button
              onClick={onFilterClear}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                historyTableFilter === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t('common.all')}
            </button>
          </div>
        )}

        {/* History list */}
        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-sm">
                {historyTableFilter
                  ? t('common.no_history_filtered', { table: historyTableFilter })
                  : t('common.no_orders_status_text')}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <HistoryPanelItem
                key={entry.id}
                entry={entry}
                isExpanded={expandedHistoryId === entry.id}
                onToggle={() => onToggleExpand(entry.id)}
                t={t}
                formatHistoryTime={formatHistoryTime}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
});

// History item subcomponent
interface HistoryPanelItemProps {
  entry: HistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatHistoryTime: (timestamp: string) => string;
}

function HistoryPanelItem({ entry, isExpanded, onToggle, t, formatHistoryTime }: HistoryPanelItemProps) {
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold bg-[#1F2937] text-white px-2 py-0.5 rounded">
              {t('common.table')} {entry.tableNumber}
            </span>
            {entry.type === 'edit' && (
              <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                {t('common.additional_service')}
              </span>
            )}
            <span className="text-[10px] text-gray-400">{formatHistoryTime(entry.timestamp)}</span>
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

      {/* Expanded details */}
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
}
