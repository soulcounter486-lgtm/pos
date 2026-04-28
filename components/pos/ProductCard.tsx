'use client';

import { memo } from 'react';
import type { Product } from '@/types';
import { useLanguage } from '@/components/LanguageProvider';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  disabled?: boolean;
}

export default memo(function ProductCard({ product, onAdd, disabled = false }: ProductCardProps) {
  const { t } = useLanguage();

  return (
    <button
      onClick={() => onAdd(product)}
      disabled={disabled || product.stock <= 0}
      className={
        'bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden text-left ' +
        (product.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5')
      }
    >
      {/* Product image */}
      <div className="w-full aspect-square bg-gray-50 flex items-center justify-center p-2 lg:p-3">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-gray-300">-</span>
        )}
      </div>

      {/* Product information */}
      <div className="p-2 lg:p-3 space-y-1">
        <p className="text-xs lg:text-sm font-semibold text-gray-800 truncate" title={product.name}>
          {product.name}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] lg:text-xs text-blue-600 font-bold">
            {product.price.toLocaleString()} VND
          </p>
          {product.tax_rate !== undefined && product.tax_rate > 0 && (
            <span className="text-[9px] lg:text-[10px] text-amber-600 bg-amber-50 px-1 rounded">
              +{Math.round(product.tax_rate * 100)}%
            </span>
          )}
        </div>
        <p className="text-[9px] lg:text-[10px] text-gray-400">
          {t('common.in_stock')}: {product.stock}
        </p>
      </div>

      {/* Out of stock overlay */}
      {product.stock <= 0 && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-400">{t('common.out_of_stock')}</span>
        </div>
      )}
    </button>
  );
});
