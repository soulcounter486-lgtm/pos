'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import type { Order, OrderItem } from '@/types';

type Tab = 'pending' | 'completed';

// Safari and older browsers webkitAudioContext type extension
interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Shared AudioContext (browser autoplay policy: unlock required after user gesture)
let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    if (sharedAudioCtx) return sharedAudioCtx;
    const w = window as WindowWithWebkit;
    const AudioCtxClass = window.AudioContext || w.webkitAudioContext;
    if (!AudioCtxClass) return null;
    sharedAudioCtx = new AudioCtxClass();
    return sharedAudioCtx;
  } catch { return null; }
}

// Play notification sound with Web Audio API — for noisy kitchen: siren pattern, square wave, loud volume 1.5 seconds
function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playNotificationSound()).catch(() => {});
      return;
    }

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // Square wave + buzzer tone (900Hz / 1300Hz alternating) repeated quickly 4 times — can be heard from far away
    const tone = (freq: number, start: number, duration: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(freq, ctx.currentTime + start);
      osc2.frequency.setValueAtTime(freq * 1.5, ctx.currentTime + start); // 5th chord — sharper
      osc1.connect(g);
      osc2.connect(g);
      g.connect(master);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + start + 0.01);
      g.gain.setValueAtTime(0.8, ctx.currentTime + start + duration - 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc1.start(ctx.currentTime + start);
      osc2.start(ctx.currentTime + start);
      osc1.stop(ctx.currentTime + start + duration);
      osc2.stop(ctx.currentTime + start + duration);
    };

    // Siren pattern: low-high 4 sets (total 1.6 seconds)
    tone(900, 0.00, 0.18);
    tone(1300, 0.20, 0.18);
    tone(900, 0.42, 0.18);
    tone(1300, 0.62, 0.18);
    tone(900, 0.84, 0.20);
    tone(1300, 1.06, 0.20);
    tone(900, 1.30, 0.30);
  } catch (e) {
    console.log('Audio playback unavailable:', e);
  }
}

export default function KitchenOrders() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const activeTabRef = useRef<Tab>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState({ pending: 0, completed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
   const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
   const [notification, setNotification] = useState<{ show: boolean; tableId: string; orderId: string; type?: string } | null>(null);
   const fetchOrdersRef = useRef<(silent?: boolean) => Promise<void>>();
   const audioEnabledRef = useRef(false);
  const prevPendingCountRef = useRef<number | null>(null);
  const lastAlertAtRef = useRef<number>(0);

  // Keep ref synchronized with current state (storage writes are explicit on toggle only)
   useEffect(() => {
     audioEnabledRef.current = audioEnabled;
   }, [audioEnabled]);

   // Initialize audioEnabled from localStorage on client only
   useEffect(() => {
     if (typeof window !== 'undefined') {
       try {
        const stored = localStorage.getItem('kitchen_audio_enabled') ?? sessionStorage.getItem('kitchen_audio_enabled');
         if (stored !== null) {
          const enabled = stored === '1';
          setAudioEnabled(enabled);
          audioEnabledRef.current = enabled;
         }
       } catch (e) {
         console.warn('Failed to read audio setting from localStorage:', e);
      }
     }
   }, []);

  // If sound is ON when page loads, automatically unlock AudioContext on first user gesture (browser autoplay policy)
  useEffect(() => {
    if (!audioEnabled) return;
    const unlock = () => {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [audioEnabled]);

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

  // Synchronize ref whenever activeTab changes + immediate refetch
  useEffect(() => {
    activeTabRef.current = activeTab;
    fetchOrders();
  }, [activeTab]);

  // Keep latest version of fetchOrders in ref (prevent stale-closure in real-time callbacks)
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  });

  // Real-time subscription (set up once, call latest fetchOrders via ref)
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

  // 5 second polling backup (in case real-time subscription fails)
  useEffect(() => {
    const interval = setInterval(() => { fetchOrdersRef.current?.(true); }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOrders(silent = false) {
    try {
      if (!silent) setLoading(true);
      const supabase = getSupabase();
      const currentTab = activeTabRef.current;

      // Get total counts regardless of tab (header counter accuracy)
      const [{ count: pendingCnt }, { count: completedCnt }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      ]);
      const nextPending = pendingCnt ?? 0;
      const prevPending = prevPendingCountRef.current;
      setCounts({ pending: nextPending, completed: completedCnt ?? 0 });

      // Fallback alert path: when pending count increases (polling or missed realtime),
      // trigger a single alert so kitchen still hears new orders.
      if (prevPending !== null && nextPending > prevPending) {
        const now = Date.now();
        if (now - lastAlertAtRef.current > 2000) {
          if (audioEnabledRef.current) playNotificationSound();
          setNotification({ show: true, tableId: '', orderId: '', type: 'new' });
          setTimeout(() => setNotification(null), 5000);
          lastAlertAtRef.current = now;
        }
      }
      prevPendingCountRef.current = nextPending;

      const [ordersResult, itemsResult, tablesResult, productsResult] = await Promise.all([
        supabase.from('orders').select('*').eq('status', currentTab).order('created_at', { ascending: false }),
        supabase.from('order_items').select('*'),
        supabase.from('tables').select('id, name'),
        supabase.from('products').select('id, name, image_url, category'),
      ]);

      if (ordersResult.error) {
        setError(t('common.order_fetch_error') + ': ' + ordersResult.error.message);
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
        setError(t('common.error_occurred') + err);
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
      if (updateError) {
        setError(t('common.order_status_update_failed'));
        return;
      }
      setError('');
      fetchOrders();
    } catch (error) {
      setError(t('common.order_completion_error'));
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
  const formatTableLabel = (rawName: string | undefined, tableId: string) => {
    if (!rawName) return `${t('common.table')} ${tableId.slice(0, 6)}…`;
    const numeric = rawName.match(/\d+/)?.[0];
    return numeric ? `${t('common.table')} ${numeric}` : rawName;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* New order notification popup */}
      {notification && notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`text-white px-6 py-4 rounded-xl shadow-2xl max-w-sm ${
            notification.type === 'new' ? 'bg-gradient-to-r from-[#78b6f1] to-[#6aa8e4]' : 'bg-gradient-to-r from-[#8ec3f2] to-[#7bb1e6]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-xl">{notification.type === 'new' ? '🔔' : '✏️'}</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">{notification.type === 'new' ? t('common.notification_new_order') : t('common.notification_order_update')}</h3>
                  <p className="text-sm opacity-90">
                    {notification.type === 'new'
                      ? t('common.notification_new_order_description')
                      : t('common.notification_order_update_description')}
                  </p>
                </div>
              </div>
              <button onClick={() => setNotification(null)} className="text-white/70 hover:text-white text-xl ml-4">✕</button>
            </div>
            <button onClick={() => { setActiveTab('pending'); setNotification(null); }}
              className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              {t('common.confirm_view')}
            </button>
          </div>
        </div>
      )}

      <header className="bg-[#f2f8ff] border-b border-[#d9ebff] px-3 py-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <h1 className="text-[#27486b] font-semibold text-sm md:text-base whitespace-nowrap flex-shrink-0">
              🍳 {t('common.kitchen_orders')}
            </h1>
            <div className="hidden sm:flex items-center gap-1 text-xs text-[#6f8fae] flex-shrink-0">
              <span>{t('common.pending')}: <span className="font-bold text-[#5f95ca]">{pendingCount}</span></span>
              <span className="text-[#b2cae4] mx-0.5">|</span>
              <span>{t('common.completed')}: <span className="font-bold text-[#4f8fcb]">{completedCount}</span></span>
            </div>
            <div className="sm:hidden flex items-center gap-0.5 text-[10px] text-[#7d9fbe] flex-shrink-0">
              <span>{pendingCount}</span>
              <span className="text-gray-500">|</span>
              <span>{completedCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <LanguageSelector />
            <button
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                audioEnabledRef.current = next;
                try {
                  localStorage.setItem('kitchen_audio_enabled', next ? '1' : '0');
                  sessionStorage.setItem('kitchen_audio_enabled', next ? '1' : '0');
                } catch {}
                if (next) playNotificationSound();
              }}
              className={`px-1.5 py-1 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap flex-shrink-0 ${audioEnabled ? 'bg-[#78b6f1] text-white' : 'bg-[#d8e9fb] text-[#5f88ae] hover:bg-[#cfe3f9]'}`}
              title={t('common.sound_toggle')}
            >
              {audioEnabled ? t('common.audio_sound_on') : t('common.audio_sound_off')}
            </button>
            <button onClick={() => { localStorage.removeItem('auth'); router.push('/login-kitchen'); }}
              className="bg-rose-500 hover:bg-rose-600 text-white px-1.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap flex-shrink-0"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-[#d9ebff] px-6 py-3">
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('pending')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'pending' ? 'bg-[#78b6f1] text-white' : 'bg-[#edf6ff] text-[#5f88ae] hover:bg-[#e2f1ff]'}`}>
            🕑 {t('common.orders_pending')} ({pendingCount})
          </button>
          <button onClick={() => setActiveTab('completed')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'completed' ? 'bg-[#78b6f1] text-white' : 'bg-[#edf6ff] text-[#5f88ae] hover:bg-[#e2f1ff]'}`}>
            ✅ {t('common.orders_completed')} ({completedCount})
          </button>
        </div>
      </div>

      <main className="flex-1 p-6 overflow-y-auto bg-white">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p className="font-semibold">{t('common.error')}</p><p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#5f88ae] text-lg">{t('common.loading')}</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">{activeTab === 'pending' ? '🕑' : '✅'}</div>
            <h2 className="text-2xl font-semibold text-[#27486b] mb-2">
              {activeTab === 'pending' ? t('common.no_pending_orders') : t('common.no_completed_orders')}
            </h2>
            <p className="text-[#7d9fbe] mb-4">
              {activeTab === 'pending' ? t('common.pending_orders_hint') : t('common.completed_orders_hint')}
            </p>
            {activeTab === 'completed' && (
              <button onClick={() => setActiveTab('pending')} className="bg-[#78b6f1] hover:bg-[#6aa8e4] text-white px-4 py-2 rounded-lg text-sm">
                {t('common.view_pending_orders')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white/90 border border-[#d9ebff] rounded-xl shadow-[0_10px_24px_rgba(125,151,210,0.16)] overflow-hidden">
                <div className={`px-4 py-3 ${order.status === 'pending' ? 'bg-[#eef6ff]' : 'bg-[#f3f9ff]'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[#27486b] font-bold text-lg">🏠 {formatTableLabel(order.table_name, order.table_id)}</h3>
                    <div className="text-right">
                      <span className={`text-sm px-2 py-1 rounded-full ${order.status === 'pending' ? 'bg-[#8fc6f7] text-white animate-pulse' : 'bg-[#78b6f1] text-white'}`}>
                        {order.status === 'pending' ? t('common.pending_status') : t('common.completed_status')}
                      </span>
                      <div className="text-[#6f8fae] text-xs mt-1">{new Date(order.created_at).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : locale === 'vi' ? 'vi-VN' : 'en-US')}</div>
                    </div>
                  </div>
                  <p className="text-[#5f88ae] text-sm mt-1">📦 {order.order_items?.length || 0}{t('common.items_count')}</p>
                </div>

                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {(order.order_items || []).map((item) => (
                    <div key={item.id} className="bg-[#f8fcff] border border-[#e1efff] rounded-lg p-3 flex items-start gap-3">
                      {item.product_image_url ? (
                        <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={item.product_image_url} alt={item.product_name || 'product'} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <span className="text-slate-400 text-xs">{t('common.no_image')}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#2f4f74] mb-1 whitespace-nowrap text-[clamp(15px,2.8vw,22px)] leading-none">
                          {item.product_name || 'Unknown'}
                        </p>
                        <p className="hidden">📂 {item.category || t('common.uncategorized')}</p>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[#5f95ca] text-sm font-bold">× {item.quantity}</p>
                        </div>
                        {/* Note display */}
                        {item.note && (
                          <div className="bg-[#eef6ff] border border-[#d6e9ff] rounded-lg px-2 py-1 mt-1">
                            <p className="text-[#5f88ae] text-xs">{t('common.note_symbol')} {item.note}</p>
                          </div>
                        )}
                      </div>
                      {item.status !== 'completed' ? (
                        <button onClick={() => markItemComplete(item.id, order.id)}
                          className='flex-shrink-0 self-center bg-[#78b6f1] hover:bg-[#6aa8e4] text-white text-xs px-3 py-1.5 rounded-lg font-bold'>
                          ✅ {t('common.mark_complete')}
                        </button>
                      ) : (
                        <span className='flex-shrink-0 self-center text-[#5f95ca] text-sm font-bold'>✅</span>
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
