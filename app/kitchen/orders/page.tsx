'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  note?: string;
  product_name?: string;
  product_image_url?: string;
  category?: string;
  status?: string;
};

type Order = {
  id: string;
  table_id: string;
  table_name?: string;
  total: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

type Tab = 'pending' | 'completed';

// Safari 등 구형 브라우저의 webkitAudioContext 타입 확장
interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Web Audio API로 알림 소리 재생
function playNotificationSound() {
  try {
    const w = window as WindowWithWebkit;
    const AudioCtxClass = window.AudioContext || w.webkitAudioContext;
    if (!AudioCtxClass) return;
    const ctx = new AudioCtxClass();

    const beep = (freq: number, start: number, duration: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    beep(880, 0, 0.15, 0.4);
    beep(1100, 0.18, 0.15, 0.4);
    beep(880, 0.36, 0.25, 0.4);
  } catch (e) {
    console.log('Audio playback unavailable:', e);
  }
}

export default function KitchenOrders() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const activeTabRef = useRef<Tab>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState({ pending: 0, completed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [notification, setNotification] = useState<{ show: boolean; tableId: string; orderId: string; type?: string } | null>(null);
  const fetchOrdersRef = useRef<(silent?: boolean) => Promise<void>>();
  const audioEnabledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedAuth = localStorage.getItem('auth');
      if (storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth);
          if (parsed.role !== 'kitchen') { router.push('/login-kitchen'); return; }
        } catch (e) {
          localStorage.removeItem('auth');
          router.push('/login-kitchen');
          return;
        }
      } else {
        router.push('/login-kitchen');
        return;
      }
      fetchOrders();
    }
  }, [router]);

  // activeTab이 바뀔 때마다 ref 동기화 + 즉시 재조회
  useEffect(() => {
    activeTabRef.current = activeTab;
    fetchOrders();
  }, [activeTab]);

  // fetchOrders 최신 버전을 ref에 보관 (실시간 콜백 stale-closure 방지)
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  });

  // 실시간 구독 (한 번만 설정, ref 통해 최신 fetchOrders 호출)
  useEffect(() => {
    const supabase = getSupabase();
    const debounceTimer = { current: null as ReturnType<typeof setTimeout> | null };
    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => { fetchOrdersRef.current?.(true); }, 300);
    };
    const ordersSubscription = supabase
      .channel('kitchen-orders-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        debouncedFetch();
        if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
          showNewOrderNotification(payload.new);
        } else if (payload.eventType === 'UPDATE' && payload.new.status === 'pending') {
          showOrderUpdateNotification(payload.new);
        }
      })
      .subscribe();
    const orderItemsSubscription = supabase
      .channel('kitchen-items-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        debouncedFetch();
      })
      .subscribe();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(orderItemsSubscription);
    };
  }, []);

  // 5초 폴링 백업 (실시간 구독이 안 될 경우 대비)
  useEffect(() => {
    const interval = setInterval(() => { fetchOrdersRef.current?.(true); }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOrders(silent = false) {
    try {
      if (!silent) setLoading(true);
      const supabase = getSupabase();
      const currentTab = activeTabRef.current;

      // 탭과 무관하게 전체 건수 파악 (헤더 카운터 정확성)
      const [{ count: pendingCnt }, { count: completedCnt }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      ]);
      setCounts({ pending: pendingCnt ?? 0, completed: completedCnt ?? 0 });

      const [ordersResult, itemsResult, tablesResult, productsResult] = await Promise.all([
        supabase.from('orders').select('*').eq('status', currentTab).order('created_at', { ascending: false }),
        supabase.from('order_items').select('*'),
        supabase.from('tables').select('id, name'),
        supabase.from('products').select('id, name, image_url, category'),
      ]);

      if (ordersResult.error) {
        setError('주문 조회 실패: ' + ordersResult.error.message);
        setLoading(false);
        return;
      }

      const tablesMap = new Map(
        (tablesResult.data || []).map((t: any) => [String(t.id), t.name as string])
      );
      const productsMap = new Map(
        (productsResult.data || []).map((p: any) => [String(p.id), p])
      );
      const allItems: any[] = itemsResult.data || [];

      const processedOrders: Order[] = (ordersResult.data || []).map((order: any) => {
        const items = allItems.filter((i: any) => i.order_id === order.id);
        return {
          id: order.id,
          table_id: order.table_id,
          table_name: tablesMap.get(String(order.table_id)) || undefined,
          total: order.total_amount ?? order.total,
          status: order.status,
          created_at: order.created_at,
          order_items: items.map((item: any) => {
            const product = productsMap.get(String(item.product_id));
            return {
              id: item.id,
              order_id: item.order_id,
              product_id: item.product_id,
              quantity: item.quantity,
              price: item.price,
              note: item.note ?? null,
              product_name: product?.name || 'Unknown',
              product_image_url: product?.image_url || null,
              category: product?.category || 'Unknown',
              status: item.status || 'pending',
            };
          }),
        };
      });

      setOrders(processedOrders);
      if (!silent) setLoading(false);
    } catch (err) {
      if (!silent) {
        setError('오류 발생: ' + err);
        setLoading(false);
      }
    }
  }

  function showNewOrderNotification(order: any) {
    if (audioEnabledRef.current) playNotificationSound();
    setNotification({ show: true, tableId: order.table_id, orderId: order.id, type: 'new' });
    setTimeout(() => setNotification(null), 6000);
  }

  function showOrderUpdateNotification(order: any) {
    setNotification({ show: true, tableId: order.table_id, orderId: order.id, type: 'update' });
    setTimeout(() => setNotification(null), 5000);
  }

  async function markOrderComplete(orderId: string) {
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
      if (updateError) { alert('주문 상태 업데이트 실패'); return; }
      fetchOrders();
    } catch (error) {
      alert('주문 완료 처리 중 오류가 발생했습니다.');
    }
  }

  async function markItemComplete(itemId: string, orderId: string) {
    const supabase = getSupabase();
    await supabase.from('order_items').update({ status: 'completed' }).eq('id', itemId);
    const { data: items } = await supabase.from('order_items').select('status').eq('order_id', orderId);
    if (items && items.every((i: any) => i.status === 'completed')) {
      await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
    }
    fetchOrders();
  }

  const pendingCount = counts.pending;
  const completedCount = counts.completed;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* 새 주문 알림 팝업 */}
      {notification && notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`text-white px-6 py-4 rounded-xl shadow-2xl max-w-sm ${
            notification.type === 'new' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-xl">{notification.type === 'new' ? '🔔' : '✏️'}</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">{notification.type === 'new' ? '새 주문 도착!' : '주문 업데이트!'}</h3>
                  <p className="text-sm opacity-90">
                    {notification.type === 'new'
                      ? `테이블에서 새 주문이 들어왔습니다.`
                      : `주문이 업데이트되었습니다.`}
                  </p>
                </div>
              </div>
              <button onClick={() => setNotification(null)} className="text-white/70 hover:text-white text-xl ml-4">✕</button>
            </div>
            <button onClick={() => { setActiveTab('pending'); setNotification(null); }}
              className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              확인하기
            </button>
          </div>
        </div>
      )}

      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg">주방 주문 화면</h1>
            <p className="text-gray-400 text-sm">주문 관리</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white text-sm">
              대기: <span className="font-bold text-yellow-400">{pendingCount}</span> | 완료: <span className="font-bold text-green-400">{completedCount}</span>
            </span>
            {/* 알림 소리 토글 */}
            <button
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                audioEnabledRef.current = next;
                if (next) playNotificationSound();
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${audioEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
              title="알림 소리 켜기/끄기"
            >
              {audioEnabled ? '🔔 소리 ON' : '🔕 소리 OFF'}
            </button>
            <button onClick={() => { localStorage.removeItem('auth'); router.push('/login-kitchen'); }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('pending')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            🕑 대기 중인 주문 ({pendingCount})
          </button>
          <button onClick={() => setActiveTab('completed')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            ✅ 완료된 주문 ({completedCount})
          </button>
        </div>
      </div>

      <main className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p className="font-semibold">오류</p><p>{error}</p>
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
              {activeTab === 'pending' ? '대기 중인 주문이 없습니다' : '완료된 주문이 없습니다'}
            </h2>
            <p className="text-gray-400 mb-4">
              {activeTab === 'pending' ? '주문이 오면 여기에 표시됩니다' : '완료된 주문이 여기에 표시됩니다'}
            </p>
            {activeTab === 'completed' && (
              <button onClick={() => setActiveTab('pending')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                ↺ 대기 중인 주문 보기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div className={`px-4 py-3 ${order.status === 'pending' ? 'bg-blue-600' : 'bg-green-600'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">🏠 {order.table_name || `테이블 ${order.table_id.slice(0, 6)}…`}</h3>
                    <div className="text-right">
                      <span className={`text-sm px-2 py-1 rounded-full ${order.status === 'pending' ? 'bg-yellow-500 text-white animate-pulse' : 'bg-green-700 text-white'}`}>
                        {order.status === 'pending' ? '대기 중...' : '완료'}
                      </span>
                      <div className="text-white text-xs mt-1">{new Date(order.created_at).toLocaleTimeString('ko-KR')}</div>
                    </div>
                  </div>
                  <p className="text-white text-sm mt-1">📦 {order.order_items?.length || 0}개 항목</p>
                </div>

                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {(order.order_items || []).map((item) => (
                    <div key={item.id} className="bg-gray-700 rounded-lg p-3 flex items-start gap-3">
                      {item.product_image_url ? (
                        <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={item.product_image_url} alt={item.product_name || 'product'} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <span className="text-slate-400 text-xs">이미지 없음</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate mb-1">{item.product_name || 'Unknown'}</p>
                        <p className="text-gray-400 text-xs mb-1">📂 {item.category || '미분류'}</p>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-blue-400 text-sm font-bold">× {item.quantity}개</p>
                        </div>
                        {/* 메모 표시 */}
                        {item.note && (
                          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg px-2 py-1 mt-1">
                            <p className="text-yellow-300 text-xs">📝 {item.note}</p>
                          </div>
                        )}
                      </div>
                      {item.status !== 'completed' ? (
                        <button onClick={() => markItemComplete(item.id, order.id)}
                          className='flex-shrink-0 self-center bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold'>
                          ✅ 완료
                        </button>
                      ) : (
                        <span className='flex-shrink-0 self-center text-green-400 text-sm font-bold'>✅</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
