'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  barcode?: string;
  stock: number;
};

type CartItem = Product & { quantity: number };

export default function StaffPos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [received, setReceived] = useState<number>(0);
  const [includeTax, setIncludeTax] = useState(true);
  const [receipt, setReceipt] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const taxRate = 0.1;

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.from('products').select('*').order('name');
    setLoading(false);
    if (error) {
      setMessage('상품 목록을 불러오지 못했습니다.');
      return;
    }
    setProducts(data || []);
  }

  // Get unique categories
  const categories = useMemo(() => {
    const cats = ['all', ...new Set(products.map(p => p.category))];
    return cats;
  }, [products]);

  // Filter products by category and search term
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.includes(searchTerm)
      );
    }

    return filtered;
  }, [products, selectedCategory, searchTerm]);

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setMessage('재고가 부족한 상품입니다.');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setMessage(null);
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((prev) => prev
      .map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item))
      .filter((item) => item.quantity > 0));
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }

  function clearCart() {
    setCart([]);
    setMessage(null);
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const taxAmount = includeTax ? subtotal * taxRate : 0;
  const total = subtotal + taxAmount;
  const change = paymentMethod === 'cash' ? Math.max(received - total, 0) : 0;

  async function handleCheckout() {
    if (cart.length === 0) {
      setMessage('장바구니에 상품을 추가하세요.');
      return;
    }

    if (paymentMethod === 'cash' && received < total) {
      setMessage('받은 금액이 총 금액보다 적습니다.');
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    const orderPayload = {
      payment_method: paymentMethod,
      subtotal: subtotal,
      tax: taxAmount,
      total: total,
      received_amount: paymentMethod === 'cash' ? received : total,
      change_amount: change,
      status: 'paid',
    };

    const { data: orderData, error: orderError } = await supabase.from('orders').insert(orderPayload).select('id').single();
    if (orderError || !orderData?.id) {
      setLoading(false);
      setMessage('결제 처리 중 오류가 발생했습니다.');
      return;
    }

    const orderItems = cart.map((item) => ({
      order_id: orderData.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) {
      setLoading(false);
      setMessage('주문 항목 저장 중 오류가 발생했습니다.');
      return;
    }

    await Promise.all(cart.map((item) => supabase.from('products').update({ stock: item.stock - item.quantity }).eq('id', item.id)));

    setReceipt(generateReceipt(orderData.id));
    setCart([]);
    setReceived(0);
    setMessage('결제가 완료되었습니다.');
    setLoading(false);
    fetchProducts();
  }

  function generateReceipt(orderId: string) {
    const lines = [
      `주문 ID: ${orderId}`,
      `결제 수단: ${paymentMethod === 'cash' ? '현금' : '카드'}`,
      '--------------------------',
      ...cart.map((item) => `${item.name} x${item.quantity}  ${item.price.toLocaleString()}원`),
      '--------------------------',
      `소계: ${subtotal.toLocaleString()}원`,
      `세금: ${taxAmount.toLocaleString()}원`,
      `총 금액: ${total.toLocaleString()}원`,
      paymentMethod === 'cash' ? `받은 금액: ${received.toLocaleString()}원` : null,
      paymentMethod === 'cash' ? `거스름돈: ${change.toLocaleString()}원` : null,
    ].filter(Boolean);

    return lines.join('\n');
  }

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Left Panel - Products */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Search and Categories */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="상품명 또는 바코드 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex space-x-2 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {category === 'all' ? '전체' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">상품을 불러오는 중...</div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded-lg p-4 text-left transition-colors border border-gray-600 hover:border-blue-500"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                      <p className="text-gray-400 text-xs mb-2">{product.category}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-bold text-lg">{product.price.toLocaleString()}원</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        product.stock > 10 ? 'bg-green-600' :
                        product.stock > 0 ? 'bg-yellow-600' : 'bg-red-600'
                      }`}>
                        {product.stock}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle Panel - Cart */}
      <div className="w-1/3 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-lg font-semibold">주문 목록</h2>
            <button
              onClick={clearCart}
              className="text-red-400 hover:text-red-300 text-sm"
              disabled={cart.length === 0}
            >
              전체 삭제
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H19M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8z" />
              </svg>
              <p>장바구니가 비어있습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium text-sm">{item.name}</h3>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 bg-gray-600 hover:bg-gray-500 rounded text-white text-xs flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="text-white text-sm w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 bg-gray-600 hover:bg-gray-500 rounded text-white text-xs flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-blue-400 font-semibold">
                      {(item.price * item.quantity).toLocaleString()}원
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Summary */}
        <div className="p-4 border-t border-gray-700">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>소계</span>
              <span>{subtotal.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>세금 (10%)</span>
              <span>{taxAmount.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-gray-600">
              <span>총 금액</span>
              <span>{total.toLocaleString()}원</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Payment */}
      <div className="w-1/6 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-white text-lg font-semibold">결제</h2>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* Payment Method */}
          <div>
            <label className="block text-gray-300 text-sm mb-2">결제 수단</label>
            <div className="space-y-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  paymentMethod === 'cash'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  현금
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  paymentMethod === 'card'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  카드
                </div>
              </button>
            </div>
          </div>

          {/* Cash Input */}
          {paymentMethod === 'cash' && (
            <div>
              <label className="block text-gray-300 text-sm mb-2">받은 금액</label>
              <input
                type="number"
                value={received}
                onChange={(e) => setReceived(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              {received > 0 && (
                <div className="mt-2 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>거스름돈</span>
                    <span className="text-green-400 font-semibold">{change.toLocaleString()}원</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tax Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">세금 포함</span>
            <button
              onClick={() => setIncludeTax(!includeTax)}
              className={`w-12 h-6 rounded-full transition-colors ${
                includeTax ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                includeTax ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Error Message */}
          {message && (
            <div className="bg-red-600 text-white p-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-4 rounded-lg transition-colors"
          >
            {loading ? '처리 중...' : `결제하기 (${total.toLocaleString()}원)`}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">영수증</h3>
            <pre className="text-sm bg-gray-100 p-4 rounded whitespace-pre-wrap">{receipt}</pre>
            <button
              onClick={() => setReceipt('')}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}