'use client';

import { memo } from 'react';
import type { CartItem } from '@/types';
import { useLanguage } from '@/components/LanguageProvider';

interface CartItemRowProps {
  item: CartItem;
  editingQuantityId: string | null;
  quantityInput: string;
  loading: boolean;
  onQuantityInputChange: (value: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onStartEditing: (id: string, quantity: number) => void;
  onSaveQuantity: (id: string) => void;
  onCancelEditing: () => void;
  onRemove: (productId: string) => void;
}

export default memo(function CartItemRow({
  item,
  editingQuantityId,
  quantityInput,
  loading,
  onQuantityInputChange,
  onUpdateQuantity,
  onStartEditing,
  onSaveQuantity,
  onCancelEditing,
  onRemove,
}: CartItemRowProps) {
  const { t } = useLanguage();

  return (
    <div className="border border-blue-100 rounded-xl bg-blue-50 px-2.5 py-1.5 space-y-1">
      <div className="flex items-center gap-2">
        {/* Product image */}
        <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-blue-100">
          {item.image_url ? (
            <img src={item.image_url} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[8px] text-gray-300">-</span>
          )}
        </div>

        {/* Product information */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#374151] truncate">{item.name}</p>
          <p className="text-[10px] text-gray-400">
            {(item.price * item.quantity).toLocaleString()} VND
          </p>
        </div>

        {/* Quantity adjustment buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {editingQuantityId === item.id ? (
            <input
              type="number"
              value={quantityInput}
              onChange={e => onQuantityInputChange(e.target.value)}
              onFocus={e => e.target.select()}
              onBlur={() => onSaveQuantity(item.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') onCancelEditing();
              }}
              className="w-14 h-6 text-center text-xs border-2 border-blue-400 rounded-lg focus:outline-none font-bold bg-white"
              autoFocus
              min="1"
            />
          ) : (
            <>
              <button
                onClick={() => onUpdateQuantity(item.id, -1)}
                disabled={loading || item.quantity <= 0}
                className="w-6 h-6 bg-white hover:bg-red-100 hover:text-red-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-blue-100"
              >
                −
              </button>
              <button
                onClick={() => onStartEditing(item.id, item.quantity)}
                className="w-8 h-6 bg-white hover:bg-blue-100 border border-blue-200 rounded-md flex items-center justify-center font-bold text-blue-700 text-xs transition-colors"
              >
                {item.quantity}
              </button>
              <button
                onClick={() => onUpdateQuantity(item.id, 1)}
                disabled={loading}
                className="w-6 h-6 bg-white hover:bg-blue-100 hover:text-blue-600 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-blue-100"
              >
                +
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="w-6 h-6 bg-white hover:bg-red-100 hover:text-red-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-blue-100"
                title={t('common.delete')}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
