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
  total: number;
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
  const [notification, setNotification] = useState<{show: boolean; tableId: string; orderId: string; type?: string} | null>(null);

  useEffect(() => {
    // 클라이언트 사이드에서만 localStorage 접근
    if (typeof window !== 'undefined') {
      const storedAuth = localStorage.getItem('auth');
      if (storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth);
          if (parsed.role !== 'kitchen') {
            router.push('/login-kitchen');
            return;
          }
        } catch (e) {
          console.error('Auth parsing error:', e);
          localStorage.removeItem('auth');
          router.push('/login-kitchen');
          return;
        }
      } else {
        router.push('/login-kitchen');
        return;
      }
      fetchOrders();
      
      // Supabase 실시간 구독 설정
      const supabase = getSupabase();
      console.log('Supabase 실시간 구독 설정 시작...');
      
      // orders 테이블 변경 감지
      const ordersSubscription = supabase
        .channel('orders-channel')
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE 모두 감지
            schema: 'public',
            table: 'orders'
          },
          (payload) => {
            console.log('주문 변경 감지:', payload);
            console.log('이벤트 타입:', payload.eventType);
            console.log('새 데이터:', payload.new);
            console.log('이전 데이터:', payload.old);
            
            fetchOrders(); // 데이터 새로고침
            
            // 새 주문이 추가되면 알림 표시
            if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
              console.log('새 주문 INSERT 감지, 알림 표시');
              showNewOrderNotification(payload.new);
            }
            // 기존 주문이 업데이트되면 알림 표시 (수량 변경 등)
            else if (payload.eventType === 'UPDATE' && payload.new.status === 'pending') {
              console.log('주문 UPDATE 감지, 알림 표시');
              showOrderUpdateNotification(payload.new);
            }
          }
        )
        .subscribe((status) => {
          console.log('orders 구독 상태:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ orders 테이블 실시간 구독 성공');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ orders 테이블 구독 실패');
          }
        });

      // order_items 테이블 변경 감지 (수량 변경 등)
      const orderItemsSubscription = supabase
        .channel('order-items-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_items'
          },
          (payload) => {
            console.log('주문 항목 변경 감지:', payload);
            console.log('이벤트 타입:', payload.eventType);
            console.log('새 데이터:', payload.new);
            console.log('이전 데이터:', payload.old);
            
            fetchOrders(); // 데이터 새로고침
          }
        )
        .subscribe((status) => {
          console.log('order_items 구독 상태:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ order_items 테이블 실시간 구독 성공');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ order_items 테이블 구독 실패');
          }
        });

      // 컴포넌트 언마운트 시 구독 해제
      return () => {
        console.log('컴포넌트 언마운트, 구독 해제');
        supabase.removeChannel(ordersSubscription);
        supabase.removeChannel(orderItemsSubscription);
      };
    }
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
        total: order.total,
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

  function showNewOrderNotification(order: any) {
    console.log('새 주문 알림:', order);
    setNotification({
      show: true,
      tableId: order.table_id,
      orderId: order.id,
      type: 'new'
    });
    
    // 5초 후 알림 자동 숨김
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  }

  function showOrderUpdateNotification(order: any) {
    console.log('주문 업데이트 알림:', order);
    setNotification({
      show: true,
      tableId: order.table_id,
      orderId: order.id,
      type: 'update'
    });
    
    // 5초 후 알림 자동 숨김
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  }

  function closeNotification() {
    setNotification(null);
  }

  async function markOrderComplete(orderId: string) {
    try {
      console.log('=== markOrderComplete 시작 ===');
      console.log('주문 ID:', orderId);
      
      const supabase = getSupabase();

      // 주문 상태를 completed로 업데이트
      console.log('주문 상태를 completed로 업데이트 중...');
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId);

      if (updateError) {
        console.error('주문 상태 업데이트 실패:', updateError);
        alert('주문 상태 업데이트 실패');
        return;
      }

      console.log('주문 상태 업데이트 완료');
      console.log('=== markOrderComplete 완료 ===');
      
      // 주문 완료 후 completed 탭으로 전환
      setActiveTab('completed');
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
      {/* 주문 알림 */}
      {notification && notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`text-white px-6 py-4 rounded-lg shadow-xl max-w-sm ${
            notification.type === 'new' 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
              : 'bg-gradient-to-r from-green-500 to-green-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-xl">
                    {notification.type === 'new' ? '🔔' : '✏️'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    {notification.type === 'new' ? '새 주문 도착!' : '주문 업데이트!'}
                  </h3>
                  <p className="text-sm opacity-90">
                    {notification.type === 'new' 
                      ? `테이블 ${notification.tableId}에서 새 주문이 들어왔습니다.`
                      : `테이블 ${notification.tableId}의 주문이 업데이트되었습니다.`}
                  </p>
                </div>
              </div>
              <button 
                onClick={closeNotification}
                className="text-white/70 hover:text-white text-xl ml-4"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => {
                  setActiveTab('pending');
                  closeNotification();
                }}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                확인하기
              </button>
            </div>
          </div>
        </div>
      )}

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