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
  image_url?: string;
};

type CartItem = Product & { quantity: number };

type Table = {
  id: string;
  name: string;
  status: string;
};

type OrderData = {
  id: string;
  table_id: string;
  total_amount: number;
  status: string;
  created_at: string;
};

type OrderItemData = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  status: string;
};

export default function StaffPos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<OrderData[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<OrderItemData[]>([]);
  const [showOrderList, setShowOrderList] = useState(false);
  const [isOrderComplete, setIsOrderComplete] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const taxRate = 0.1;

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (showOrderList || isOrderComplete) return;
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [showOrderList, isOrderComplete]);

  useEffect(() => {
    if (isOrderComplete) {
      setIsOrderComplete(false);
      setSelectedTable(null);
      setMessage(null);
    }
  }, [isOrderComplete]);

  async function loadAllData() {
    await Promise.all([
      fetchProducts(),
      fetchTables(),
      fetchOrders()
    ]);
    setDataLoaded(true);
    console.log('All data loaded');
  }

  async function fetchProducts() {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      setMessage('상품 목록을 불러오지 못했습니다.');
    }
    setLoading(false);
  }

  async function fetchTables() {
    setLoadingTables(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('tables').select('*');
      if (error) throw error;
      setTables(data || []);
    } catch (e) {
      console.error('Table error:', e);
    }
    setLoadingTables(false);
  }

  async function fetchOrders() {
    try {
      const supabase = getSupabase();
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      const { data: items } = await supabase
        .from('order_items')
        .select('*');
      setAllOrders(orders || []);
      setAllOrderItems(items || []);
      console.log('Orders loaded:', orders?.length, 'Items loaded:', items?.length);
    } catch (e) {
      console.error('Orders error:', e);
    }
  }

  async function deleteAllOrdersForTable(tableId: string) {
    if (!confirm('테이블 ' + tableId + '의 모든 주문을 삭제하시겠습니까?\n\n이 작업은 복구할 수 없습니다.')) {
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();

      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', tableId);

      const orderIds = orders?.map((o: any) => o.id) || [];

      if (orderIds.length > 0) {
        await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds);
      }

      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('table_id', tableId);

      if (deleteError) throw deleteError;

      setMessage('테이블 ' + tableId + ' 주문 ' + orderIds.length + '개가 삭제되었습니다!');
      await fetchOrders();
    } catch (error) {
      console.error('Delete error:', error);
      setMessage('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const tableOrderInfo: Record<string, { orders: OrderData[], totalAmount: number }> = useMemo(() => {
    const info: Record<string, { orders: OrderData[], totalAmount: number }> = {};
    
    allOrders.forEach(order => {
      const key = String(order.table_id);
      if (!info[key]) {
        info[key] = { orders: [], totalAmount: 0 };
      }
      info[key].orders.push(order);
      info[key].totalAmount += order.total_amount;
    });

    console.log('tableOrderInfo keys:', Object.keys(info));
    
    return info;
  }, [allOrders]);

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setMessage('재고가 부족한 상품입니다.');
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        setCart(cart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        ));
      } else {
        setMessage('재고가 부족합니다.');
      }
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  }

  function updateQuantity(productId: string, delta: number) {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity > 0 && newQuantity <= item.stock) {
          return { ...item, quantity: newQuantity };
        }
      }
      return item;
    }));
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter(item => item.id !== productId));
  }

  async function submitOrder() {
    if (cart.length === 0) {
      setMessage('주문할 상품이 없습니다.');
      return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    setLoading(true);
    try {
      const supabase = getSupabase();

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: selectedTable,
          total_amount: total,
          status: 'pending',
          payment_method: 'card',
          include_tax: true,
          subtotal: subtotal,
          tax_amount: tax
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItemData = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        status: 'pending'
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemData);

      if (itemsError) throw itemsError;

      setCart([]);
      setMessage('주문이 완료되었습니다!');
      setIsOrderComplete(true);

      await fetchOrders();

      setTimeout(() => {
        setSelectedTable(null);
        setMessage(null);
      }, 2000);

    } catch (error) {
      setLoading(false);
      setMessage('주문 처리 중 오류 발생');
    }
  }

  const cartTotal = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    return subtotal + tax;
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const categories = useMemo(() => {
    return ['all', ...new Set(products.map(p => p.category))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    if (searchTerm) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  if (isOrderComplete) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">주문 완료!</h2>
          <p className="text-gray-400">테이블 선택 화면으로 돌아갑니다...</p>
        </div>
      </div>
    );
  }

  if (!dataLoaded || loadingTables) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white text-lg">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!selectedTable) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <h1 className="text-white font-semibold text-lg">POS 시스템</h1>
          <p className="text-gray-400 text-sm">직원 모드 - 테이블 선택 ({allOrders.length} 주문)</p>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {tables.map(table => {
              const tableIdStr = String(table.id);
              const orderInfo = tableOrderInfo[tableIdStr];
              const hasPending = orderInfo?.orders.some((o: OrderData) => o.status === 'pending');
              const totalOrders = orderInfo?.orders.length || 0;
              const pendingCount = orderInfo?.orders.filter((o: OrderData) => o.status === 'pending').length || 0;
              const completedCount = totalOrders - pendingCount;
              const totalAmount = orderInfo?.totalAmount || 0;

              console.log('Table ' + tableIdStr + ': ' + (hasPending ? 'RED' : 'GREEN') + ', Orders: ' + totalOrders);

              return (
                <button
                  key={table.id}
                  onClick={() => {
                    setSelectedTable(tableIdStr);
                    setShowOrderList(true); // 항상 주문내역 먼저
                  }}
                  className={`p-6 rounded-xl border-2 transition-all hover:scale-105 relative ${
                    hasPending
                      ? 'bg-red-50 border-red-400 hover:border-red-600'
                      : 'bg-green-50 border-green-300 hover:border-green-500'
                  }`}
                >
                  {totalAmount > 0 && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                      {totalAmount.toLocaleString()} VND
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-3xl mb-2">{hasPending ? '🔴' : '🟢'}</div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1">Table {table.id}</h3>
                    <p className={`text-sm font-medium ${
                      table.status === 'occupied' || hasPending ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {table.status === 'occupied' || hasPending ? '사용 중' : '사용 가능'}
                    </p>
                    {totalOrders > 0 && (
                      <div className="mt-3 flex gap-2 justify-center">
                        <div className="bg-blue-100 border border-blue-300 rounded-lg px-2 py-1 text-xs">전체: {totalOrders}</div>
                        {pendingCount > 0 && (
                          <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-2 py-1 text-xs">대기: {pendingCount}</div>
                        )}
                        {completedCount > 0 && (
                          <div className="bg-green-100 border border-green-300 rounded-lg px-2 py-1 text-xs">완료: {completedCount}</div>
                        )}
                      </div>
                    )}
                    {totalOrders === 0 && <p className="text-xs text-gray-400 mt-2">(주문 없음)</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </main>

        {message && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
            {message}
          </div>
        )}
      </div>
    );
  }

  // 주문내역 페이지
  if (showOrderList) {
    const tableOrders = allOrders.filter((o: OrderData) => String(o.table_id) === selectedTable);
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <header className="bg-white shadow-sm p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setShowOrderList(false);
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium"
              >
                주문내역
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">테이블 {selectedTable}</h1>
                <p className="text-sm text-gray-500">주문 내역 ({tableOrders.length}개)</p>
              </div>
            </div>
            <button 
              onClick={() => deleteAllOrdersForTable(selectedTable!)} 
              disabled={loading || tableOrders.length === 0}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-bold text-sm"
            >
              전체 삭제
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {tableOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-bold mb-2">주문 내역이 없습니다.</h2>
              <p className="text-lg">새로운 주문을 추가해보세요.</p>
            </div>
          ) : (
            tableOrders.map((order: OrderData) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold">주문 #{order.id.substring(order.id.length - 8)}</span>
                      <span className={`ml-4 px-4 py-2 rounded-full text-sm font-bold ${
                        order.status === 'pending' ? 'bg-yellow-400/20 backdrop-blur-sm' : 'bg-green-400/20 backdrop-blur-sm'
                      }`}>
                        {order.status === 'pending' ? '🟡 대기 중' : '✅ 완료'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{order.total_amount.toLocaleString()} VND</p>
                      <p className="text-sm opacity-90">{new Date(order.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-xl text-gray-800 mb-4">주문 항목</h3>
                  <div className="space-y-3">
                    {allOrderItems
                      .filter((i: OrderItemData) => i.order_id === order.id)
                      .map((item: OrderItemData) => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                              {product?.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium">이미지 없음</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{product?.name || 'Unknown'}</p>
                              <p className="text-gray-500 text-xs">{product?.category || '미분류'}</p>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <p className="font-bold text-gray-900 text-lg">x {item.quantity}</p>
                              <p className="text-gray-600 text-sm">{item.price.toLocaleString()} VND</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))
          )}
        </main>

        <button 
          onClick={() => setShowOrderList(false)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-green-500 hover:bg-green-600 text-white text-2xl rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center z-50"
          title="새 주문 추가"
        >
          +
        </button>

        {message && (
          <div className="fixed bottom-24 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg max-w-sm">
            {message}
          </div>
        )}
      </div>
    );
  }

  // 메뉴 주문 페이지
  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-center mb-3">
          <button 
            onClick={() => setShowOrderList(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm mr-4"
          >
            주문내역
          </button>
          <h1 className="text-xl font-bold text-slate-900">테이블 {selectedTable}</h1>
        </div>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            placeholder="상품명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-lg text-sm ${
                selectedCategory === category ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col ${
                  product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className="w-full h-28 bg-slate-100 flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="text-slate-400 text-xs">없음</div>
                  )}
                </div>
                <div className="flex-1 p-2">
                  <h3 className="font-semibold text-gray-900 text-xs mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-gray-500 text-xs mb-1">{product.category}</p>
                  <p className="text-blue-600 font-bold text-sm">{product.price.toLocaleString()} VND</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        <div className="mb-4 max-h-48 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="text-gray-500 text-sm text-center">주문할 상품이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-gray-500 text-xs">{item.price.toLocaleString()} VND</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center">-</button>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center">+</button>
                    <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div>
            <p className="text-gray-600 text-sm">총계: <span className="font-bold text-lg">{cartTotal.toLocaleString()} VND</span></p>
            <p className="text-gray-500 text-xs">상품 {cartCount}개</p>
          </div>
          <button
            onClick={submitOrder}
            disabled={loading || cart.length === 0}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '처리 중...' : '주문하기'}
          </button>
        </div>
      </div>
    </div>
  );
}