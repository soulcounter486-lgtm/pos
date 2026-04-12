'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product_name?: string;
  product_image_url?: string;
  category?: string;
};

type Order = {
  id: string;
  table_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

type Tab = 'pending' | 'completed';

export default function KitchenOrders() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedAuth = localStorage.getItem('auth');
    if (storedAuth) {
      const parsed = JSON.parse(storedAuth);
      if (parsed.role !== 'kitchen') {
        router.push('/login-kitchen');
        return;
      }
    } else {
      router.push('/login-kitchen');
      return;
    }
    fetchOrders();
  }, [router, activeTab]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const supabase = getSupabase();
      
      // 메뉴 목록 가져오기 (이미지, 상품명, 카테고리)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, image_url, category');

      // Orders 가져오기
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            order_id,
            product_id,
            quantity,
            price
          )
        `)
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Supabase error:', fetchError);
        setError('주문 조회 실패: ' + fetchError.message);
        setLoading(false);
        return;
      }

      // 메뉴 정보 매핑
      const productsMap = new Map<string, any>();
      productsData?.forEach((product: any) => {
        productsMap.set(product.id, product);
      });

      const processedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        table_id: order.table_id,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        order_items: (order.order_items || []).map((item: any) => {
          const product = productsMap.get(item.product_id);
          return {
            ...item,
            product_name: product?.name || 'Unknown',
            product_image_url: product?.image_url || null,
            category: product?.category || 'Unknown'
          };
        })
      }));

      console.log(`${activeTab} orders:`, processedOrders);
      setOrders(processedOrders);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError('오류 발생: ' + err);
      setLoading(false);
    }
  }

  async function markOrderComplete(orderId: string) {
    try {
      const supabase = getSupabase();

      await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId);

      fetchOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      alert('주문 완료 처리 중 오류가 발생했습니다.');
    }
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg">주방 주문 화면</h1>
            <p className="text-gray-400 text-sm">주문 관리</p>
          </div>
          <div className="flex gap-4">
            <span className="text-white text-sm">
              대기중: <span className="font-bold">{pendingCount}</span> | 
              완료: <span className="font-bold text-green-400">{completedCount}</span>
            </span>
            <button
              onClick={() => {
                localStorage.removeItem('auth');
                router.push('/login-kitchen');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🕑 대기 중인 주문 ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ✅ 완료된 주문 ({completedCount})
          </button>
        </div>
      </div>

      <main className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p className="font-semibold">오류</p>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-lg">로딩 중...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">{activeTab === 'pending' ? '🕑' : '✅'}</div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {activeTab === 'pending' 
                ? '대기 중인 주문이 없습니다' 
                : '완료된 주문이 없습니다'}
            </h2>
            <p className="text-gray-400 mb-4">
              {activeTab === 'pending' 
                ? '주문이 오면 여기에 표시됩니다' 
                : '완료된 주문이 여기에 표시됩니다'}
            </p>
            {activeTab === 'completed' && (
              <button
                onClick={() => setActiveTab('pending')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                ↺ 대기 중인 주문 보기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className={`px-4 py-3 ${
                  order.status === 'pending' 
                    ? 'bg-blue-600' 
                    : 'bg-green-600'
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">
                      🏠 테이블 {order.table_id}
                    </h3>
                    <div className="text-right">
                      <span className={`text-sm px-2 py-1 rounded-full ${
                        order.status === 'pending' 
                          ? 'bg-yellow-500 text-white animate-pulse' 
                          : 'bg-green-700 text-white'
                      }`}>
                        {order.status === 'pending' ? '대기 중...' : '완료'}
                      </span>
                      <div className="text-white text-xs mt-1">
                        {new Date(order.created_at).toLocaleTimeString('ko-KR')}
                      </div>
                    </div>
                  </div>
                  <p className="text-white text-sm mt-1">
                    📦 {order.order_items?.length || 0}개 항목
                  </p>
                </div>

                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {(order.order_items || []).map((item, index) => (
                    <div 
                      key={item.id} 
                      className="bg-gray-700 hover:bg-gray-650 rounded-lg p-3 flex items-center gap-3 transition-colors"
                    >
                      {item.product_image_url ? (
                        <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={item.product_image_url}
                            alt={item.product_name || 'product'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <span className="text-slate-400 text-xs">이미지 없음</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate mb-1">
                          {item.product_name || 'Unknown'}
                        </p>
                        <p className="text-gray-400 text-xs mb-1">
                          📂 {item.category || '미분류'}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-blue-400 text-xs font-medium">
                            x {item.quantity}개
                          </p>
                          <p className="text-white text-xs font-bold">
                            ({item.price.toLocaleString()} VND)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 bg-gray-750 border-t border-gray-700">
                  {order.status === 'pending' ? (
                    <button
                      onClick={() => markOrderComplete(order.id)}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      ✅ 완료 처리
                    </button>
                  ) : (
                    <div className="text-center text-green-400 font-semibold">
                      ✅ completed
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}