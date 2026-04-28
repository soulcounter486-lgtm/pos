'use client';

import { memo } from 'react';
import type { Product, CartItem } from '@/types';
import CategoryBar from '@/components/pos/CategoryBar';
import ProductCard from '@/components/pos/ProductCard';
import { useLanguage } from '@/components/LanguageProvider';

interface MenuViewProps {
  // Category state
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  getCategoryLabel: (cat: string) => string;

  // Products state
  filteredProducts: Product[];
  products: Product[];
  loading: boolean;

  // Cart state
  cart: CartItem[];
  cartMemos: Record<string, string>;
  editingQuantityId: string | null;
  quantityInput: string;
  setQuantityInput: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedTable: string | null;

  // Cart functions
  addToCart: (product: Product) => void;
  updateQuantity: (id: string, delta: number) => void;
  startEditingQuantity: (id: string, quantity: number) => void;
  saveQuantity: (id: string) => void;
  cancelEditing: () => void;
  removeFromCart: (productId: string) => void;
  setCartMemos: (memos: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;

  // Navigation & submission
  goBack: () => void;
  navigateTo: (view: 'orders' | 'menu') => void;
  submitOrder: () => void;

  // Layout: true on PC (lg breakpoint)
  pcSplit: boolean;

  // Computed
  cartSubtotal: number;
}

export default memo(function MenuView({
  categories,
  selectedCategory,
  setSelectedCategory,
  getCategoryLabel,
  filteredProducts,
  products,
  loading,
  cart,
  cartMemos,
  editingQuantityId,
  quantityInput,
  setQuantityInput,
  searchTerm,
  setSearchTerm,
  selectedTable,
  addToCart,
  updateQuantity,
  startEditingQuantity,
  saveQuantity,
  cancelEditing,
  removeFromCart,
  setCartMemos,
  goBack,
  navigateTo,
  submitOrder,
  pcSplit,
  cartSubtotal,
}: MenuViewProps) {
  const { t } = useLanguage();
  return (
    <div className="h-full min-h-0 lg:overflow-hidden bg-[#F8F9FA] lg:flex lg:flex-row">
      {/* ===== Left: Product Area ===== */}
      <div className="flex-1 flex flex-col min-h-0 lg:h-full lg:overflow-y-auto">
        <header className="bg-white border-b border-[#E5E7EB] px-3 lg:px-4 py-2.5 lg:py-3 shadow-sm">
          <div className="flex items-center justify-between mb-2 lg:mb-3">
            <div className="flex items-center gap-2 lg:gap-3">
              <button onClick={goBack} className="text-gray-400 hover:text-[#111827]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h1 className="text-base lg:text-lg font-bold text-[#111827]">{t('common.table')} {selectedTable}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateTo('orders')}
                className={
                  'text-xs lg:text-sm text-blue-500 font-medium px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg hover:bg-blue-50 transition-colors ' +
                  (pcSplit ? 'lg:hidden' : '')
                }
              >
                {t('common.history')}
              </button>
            </div>
          </div>
          <div className="mb-2 lg:mb-3">
            <input
              type="text"
              placeholder={`${t('common.search')}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-3 lg:px-4 py-2 lg:py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-[#374151] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <CategoryBar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            getCategoryLabel={getCategoryLabel}
          />
        </header>

        {/* ===== Mobile Only: Selected Menu List (Fixed below header) ===== */}
        {cart.length > 0 && (
          <div className="lg:hidden bg-white border-b border-blue-100 px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-blue-700">
                {t('common.selected_items')} {cart.reduce((s, i) => s + i.quantity, 0)}{t('common.unit')}
              </span>
              <span className="text-xs font-bold text-blue-700">{cartSubtotal.toLocaleString()} VND</span>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="border border-blue-100 rounded-xl bg-blue-50 px-2.5 py-1.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-blue-100">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[8px] text-gray-300">-</span>
                      )}
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
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="w-14 h-6 text-center text-xs border-2 border-blue-400 rounded-lg focus:outline-none font-bold bg-white"
                          autoFocus
                          min="1"
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            disabled={loading || item.quantity <= 0}
                            className="w-6 h-6 bg-white hover:bg-red-100 hover:text-red-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-blue-100"
                          >
                            −
                          </button>
                          <button
                            onClick={() => startEditingQuantity(item.id, item.quantity)}
                            className="w-8 h-6 bg-white hover:bg-blue-100 border border-blue-200 rounded-md flex items-center justify-center font-bold text-blue-700 text-xs transition-colors"
                          >
                            {item.quantity}
                          </button>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={loading}
                            className="w-6 h-6 bg-white hover:bg-blue-100 hover:text-blue-600 rounded-md flex items-center justify-center font-bold text-gray-500 text-xs transition-colors border border-blue-100"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-6 h-6 bg-red-50 hover:bg-red-100 rounded-md flex items-center justify-center text-red-400 text-[10px] ml-0.5 transition-colors"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder={`📝 ${t('common.kitchen_memo')}`}
                    value={cartMemos[item.id] || ''}
                    onChange={e => setCartMemos(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-full text-[10px] px-2 py-1 bg-white border border-blue-100 rounded-lg text-blue-700 placeholder-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">{t('common.loading')}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 lg:gap-3">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                  disabled={product.stock <= 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Mobile Bottom: Total + Order Button Only ===== */}
      <div className="bg-white border-t border-gray-100 px-3 lg:hidden py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.06)] z-30">
        {cart.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-1">{t('common.empty_cart')}</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-[#111827]">
              {cartSubtotal.toLocaleString()}{' '}
              <span className="text-xs font-normal text-gray-400">VND</span>
            </p>
            <p className="text-[10px] text-gray-400">
              {cart.reduce((s, i) => s + i.quantity, 0)}{t('common.unit')}
            </p>
          </div>
          <button
            onClick={submitOrder}
            disabled={loading || cart.length === 0}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20"
          >
            {loading ? t('common.processing') : t('common.order_now')}
          </button>
        </div>
      </div>

      {/* ===== Right: Cart - PC Sidebar ===== */}
      <div className="hidden lg:block lg:w-80 xl:w-96">
        <div className="sticky top-0 h-screen bg-white border-l border-gray-100 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111827]">
              {t('common.cart_label')}{' '}
              <span className="text-sm font-normal text-gray-400">({cart.reduce((s, i) => s + i.quantity, 0)}{t('common.unit')})</span>
            </h2>
            <button
              onClick={goBack}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {t('common.history')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 && <p className="text-center text-xs text-gray-400 py-8">{t('common.select_product_prompt')}</p>}
            {cart.map(item => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[8px] text-gray-300">-</span>
                    )}
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
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="w-14 h-7 text-center text-xs border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-bold"
                          autoFocus
                          min="1"
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 bg-white hover:bg-red-100 hover:text-red-500 rounded-md flex items-center justify-center font-bold text-gray-500 text-sm transition-colors border border-gray-100"
                        >
                          −
                        </button>
                        <button
                          onClick={() => startEditingQuantity(item.id, item.quantity)}
                          className="w-9 h-7 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md flex items-center justify-center font-bold text-blue-700 text-sm transition-colors"
                        >
                          {item.quantity}
                        </button>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 bg-white hover:bg-blue-100 hover:text-blue-600 rounded-md flex items-center justify-center font-bold text-gray-500 text-sm transition-colors border border-gray-100"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-7 h-7 bg-red-50 hover:bg-red-100 rounded-md flex items-center justify-center text-red-400 text-xs ml-0.5 transition-colors"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder={t('common.kitchen_memo_optional')}
                  value={cartMemos[item.id] || ''}
                  onChange={e => setCartMemos(prev => ({ ...prev, [item.id]: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 placeholder-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
            ))}
          </div>

          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-lg font-bold text-[#111827]">
                  {cartSubtotal.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-gray-400">VND</span>
                </p>
                <p className="text-[10px] text-gray-400">
                  {cart.reduce((s, i) => s + i.quantity, 0)}{t('common.unit')}
                </p>
              </div>
              <button
                onClick={submitOrder}
                disabled={loading || cart.length === 0}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20"
              >
                {loading ? t('common.processing') : t('common.order_now')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
