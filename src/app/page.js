'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { onForegroundMessage, requestFcmToken } from '@/lib/firebaseClient.js';
import { createApiFetch, jsonBody } from '@/lib/apiClient.js';
import Header from '@/components/Header';
import NavTabs from '@/components/NavTabs';
import LoginPage from '@/features/auth/LoginPage';
import OrdersPage from '@/features/orders/OrdersPage';
import MenuPage from '@/features/menu/MenuPage';
import StaffPage from '@/features/staff/StaffPage';
import SitesPage from '@/features/sites/SitesPage';
import LayoutBuilderPage from '@/features/layout-builder/LayoutBuilderPage';
import ChatsPage from '@/features/chats/ChatsPage';
import TeamChatPage from '@/features/chats/TeamChatPage';
import SmartAiPage from '@/features/ai/SmartAiPage';
import CartPage from '@/features/cart/CartPage';
import BillingCheckoutPage from '@/features/billing/BillingCheckoutPage';
import PendingCashBillsPage from '@/features/billing/PendingCashBillsPage';
import IotDevicesPage from '@/features/iot/IotDevicesPage';
import DeliveryPage from '@/features/delivery/DeliveryPage';
import WalletPage from '@/features/wallet/WalletPage';

// Ported from react_app/src/App.jsx — the dashboard shell that owns every
// piece of cross-page state (auth, cart, orders, menu, the one shared
// Socket.IO connection) and tab-switches between the 7 feature pages below,
// same lift-and-shift architecture react_app used (no client-side routing
// there either — every "page" was really just tab content). Chosen over a
// route-per-page rewrite since this is a real-time authenticated dashboard
// with no SEO need — Server Components would buy little here, and cart/
// socket state would need a shared client layout regardless.

// Two cart lines for the same item only merge if they carry the exact same
// selection — a Cappuccino with Oat milk and one with Almond milk are
// genuinely different lines, not one line with quantity 2. Mirrors
// flutter_app's ChatbotNotifier._sameSelection.
const sameSelection = (a, b) => {
  if (a.length !== b.length) return false;
  const aIds = new Set(a.map((o) => o.choiceId));
  const bIds = new Set(b.map((o) => o.choiceId));
  return aIds.size === bIds.size && [...aIds].every((id) => bIds.has(id));
};

export default function Home() {
  // --- Auth state ---
  const [authToken, setAuthToken] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''));
  const [authRole, setAuthRole] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('role') || '' : ''));
  const [authName, setAuthName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : ''));
  const [myId, setMyId] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''));

  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');

  // Which site the Layout Builder tab opens to — set when SitesPage's
  // "Layout" button hands a site off (plan Phase 2a); the Layout Builder
  // tab itself still works standalone (defaults to the org's first site)
  // when reached directly from the nav instead.
  const [layoutSiteId, setLayoutSiteId] = useState(null);

  // One shared cart for the whole customer experience — Menu, Smart Waiter,
  // and AI Chat all read/write the same cart, exactly like flutter_app's
  // ChatbotNotifier is the single cart owner for every customer surface.
  const [cart, setCart] = useState([]); // [{item, quantity, selectedOptions}]

  const addToCart = (item, quantity = 1, selectedOptions = []) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.item._id === item._id && sameSelection(c.selectedOptions, selectedOptions));
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + quantity };
        return next;
      }
      return [...prev, { item, quantity, selectedOptions }];
    });
  };

  // id-based — used by the AI ordering path, which reasons about items by
  // name/id, not by cart-line index. Updates the first matching line.
  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) => prev.map((c) => (c.item._id === itemId ? { ...c, quantity } : c)));
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((c) => c.item._id !== itemId));
  };

  // Index-based — used by the cart drawer UI, where two lines can share the
  // same item id but different selected options.
  const updateCartQuantityAt = (index, quantity) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setCart((prev) => prev.map((c, i) => (i === index ? { ...c, quantity } : c)));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, c) => {
    const optionsDelta = c.selectedOptions.reduce((s, o) => s + (o.priceDelta || 0), 0);
    return sum + (c.item.price + optionsDelta) * c.quantity;
  }, 0);
  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // [fulfillment] is { orderType: 'pickup'|'dine_in'|'delivery', tableNumber?,
  // deliveryAddress?, deliveryLat?, deliveryLng?, deliveryPincode? } from
  // CartPage — merged straight into the order payload. Omitted entirely (AI
  // ordering path) defaults server-side to a plain pickup order.
  const placeCartOrder = async (fulfillment = {}) => {
    if (cart.length === 0) return false;
    try {
      const res = await apiFetch('/orders', {
        method: 'POST',
        ...jsonBody({
          items: cart.map((c) => ({
            menuItemId: c.item._id,
            quantity: c.quantity,
            selectedOptions: c.selectedOptions.map((o) => ({ choiceId: o.choiceId }))
          })),
          ...fulfillment
        })
      });
      if (!res.ok) return false;
      clearCart();
      return true;
    } catch (e) {
      console.error('Failed to place order:', e);
      return false;
    }
  };

  const cartApi = {
    cart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    updateCartQuantityAt,
    clearCart,
    cartTotal,
    cartItemCount,
    placeCartOrder
  };

  // The shared socket instance, exposed to pages that need live updates
  // (ChatsPage) — mirrors the Flutter app's single shared SocketDatasource
  // rather than each page opening its own connection.
  const [socket, setSocket] = useState(null);

  // Holds the current browser's FCM token so logout can unregister it while
  // the JWT is still valid — mirrors the Flutter app's unregisterToken().
  const fcmTokenRef = useRef(null);

  const clearAuth = () => {
    if (fcmTokenRef.current) {
      apiFetch('/devices/unregister', { method: 'DELETE', ...jsonBody({ fcmToken: fcmTokenRef.current }) }).catch(() => {});
      fcmTokenRef.current = null;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    setAuthToken('');
    setAuthRole('');
    setAuthName('');
    setMyId('');
    setOrders([]);
    setMenu([]);
  };

  const apiFetch = createApiFetch(clearAuth);

  const handleLoginSuccess = (token, role, name, userId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('userName', name);
    localStorage.setItem('userId', userId);
    setAuthToken(token);
    setAuthRole(role);
    setAuthName(name);
    setMyId(userId);
    setActiveTab('orders');
  };

  // Requests notification permission and registers this browser's FCM token
  // with the backend so notifyUser/notifyRole (order + chat events) can
  // reach this session — best-effort, mirrors NotificationService.syncToken()
  // in the Flutter app.
  const registerPushToken = async () => {
    try {
      const fcmToken = await requestFcmToken();
      if (!fcmToken) return;
      fcmTokenRef.current = fcmToken;
      await apiFetch('/devices/register', { method: 'POST', ...jsonBody({ fcmToken, platform: 'web' }) });
    } catch (e) {
      console.error('Failed to register push notification token:', e);
    }
  };

  const fetchOrders = async (role, showAllHistory = false) => {
    const dateParams = showAllHistory
      ? ''
      : (() => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return `&fromDate=${encodeURIComponent(start.toISOString())}&toDate=${encodeURIComponent(now.toISOString())}`;
        })();

    setOrdersLoading(true);
    try {
      if (role === 'cook') {
        // Queue is never date-filtered — an unclaimed order is always
        // relevant regardless of age. "Mine" respects the today/all toggle.
        const [queueRes, mineRes] = await Promise.all([
          apiFetch('/orders/history?scope=queue&limit=100'),
          apiFetch(`/orders/history?scope=mine&limit=100${dateParams}`)
        ]);
        const [queueData, mineData] = await Promise.all([queueRes.json(), mineRes.json()]);
        const queueOrders = queueData.orders || [];
        const mineOrders = mineData.orders || [];
        const merged = [...queueOrders, ...mineOrders.filter((o) => !queueOrders.some((q) => q._id === o._id))];
        setOrders(merged);
      } else {
        const res = await apiFetch(`/orders/history?limit=100${dateParams}`);
        const data = await res.json();
        if (data.orders) setOrders(data.orders);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchMenu = async () => {
    setMenuLoading(true);
    try {
      const res = await apiFetch('/menu');
      const data = await res.json();
      if (Array.isArray(data)) setMenu(data);
    } catch (e) {
      console.error('Failed to fetch menu:', e);
    } finally {
      setMenuLoading(false);
    }
  };

  useEffect(() => {
    if (!authToken) return undefined;

    fetchOrders(authRole);
    fetchMenu();

    const s = io({ transports: ['websocket'], auth: { token: authToken } });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('customers-orders-cafe', (newOrder) => {
      setOrders((prev) => [newOrder, ...prev.filter((o) => o._id !== newOrder._id)]);
    });
    s.on('order_update', (updatedOrder) => {
      setOrders((prev) => prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o)));
    });

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, authRole]);

  // Re-registers the push token on every login (including a cached token on
  // page reload) — a fresh device/browser has no token registered yet.
  useEffect(() => {
    if (!authToken) return;
    registerPushToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Foreground pushes aren't shown automatically by the browser (only
  // background/terminated ones, via public/firebase-messaging-sw.js) — show
  // them as a native notification here instead.
  useEffect(() => {
    return onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' });
      }
    });
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await apiFetch(`/orders/${orderId}/status`, { method: 'PATCH', ...jsonBody({ status: newStatus }) });
      const data = await res.json();
      if (data.order) setOrders((prev) => prev.map((o) => (o._id === orderId ? data.order : o)));
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const handleClaimOrder = async (orderId) => {
    try {
      const res = await apiFetch(`/orders/${orderId}/claim`, { method: 'PATCH' });
      if (res.status === 409) {
        // Another cook won the race — sync back up with the server instead
        // of treating it as a hard error.
        window.alert('Someone else already claimed this order.');
        fetchOrders(authRole);
        return;
      }
      const data = await res.json();
      if (data.order) setOrders((prev) => prev.map((o) => (o._id === orderId ? data.order : o)));
    } catch (e) {
      console.error('Failed to claim order:', e);
    }
  };

  // Shared sink for anything that PATCHes an order and gets a fresh one
  // back — used by DeliveryPage's rider/status controls, same merge
  // pattern as handleStatusChange/handleClaimOrder above so the Orders tab
  // stays in sync without a second fetch.
  const handleOrderUpdated = (updatedOrder) => {
    if (!updatedOrder) return;
    setOrders((prev) => prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o)));
  };

  if (!authToken) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-root">
      <Header connected={connected} authName={authName} authRole={authRole} onLogout={clearAuth} />

      <main className="dashboard-container">
        <NavTabs activeTab={activeTab} onChange={setActiveTab} authRole={authRole} />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'orders' && (
              <OrdersPage
                orders={orders}
                loading={ordersLoading}
                authRole={authRole}
                onClaim={handleClaimOrder}
                onStatusChange={handleStatusChange}
                onRefetch={(showAllHistory) => fetchOrders(authRole, showAllHistory)}
              />
            )}

            {activeTab === 'menu' && (
              <MenuPage
                menu={menu}
                loading={menuLoading}
                setMenu={setMenu}
                authRole={authRole}
                apiFetch={apiFetch}
                cartApi={cartApi}
                onOpenCart={() => setActiveTab('cart')}
              />
            )}

            {activeTab === 'cart' && authRole === 'customer' && (
              <CartPage cartApi={cartApi} onDone={() => setActiveTab('orders')} onBack={() => setActiveTab('menu')} />
            )}

            {activeTab === 'sites' && (authRole === 'owner' || authRole === 'manager') && (
              <SitesPage
                apiFetch={apiFetch}
                authRole={authRole}
                onOpenLayout={(site) => {
                  setLayoutSiteId(site.id);
                  setActiveTab('layout');
                }}
              />
            )}

            {activeTab === 'layout' && (authRole === 'owner' || authRole === 'manager') && (
              <LayoutBuilderPage apiFetch={apiFetch} authRole={authRole} initialSiteId={layoutSiteId} />
            )}

            {activeTab === 'staff' && (authRole === 'owner' || authRole === 'manager') && <StaffPage apiFetch={apiFetch} authRole={authRole} />}

            {activeTab === 'billing' && authRole === 'customer' && (
              <BillingCheckoutPage apiFetch={apiFetch} socket={socket} authName={authName} />
            )}

            {activeTab === 'cash-bills' && (authRole === 'owner' || authRole === 'manager') && (
              <PendingCashBillsPage apiFetch={apiFetch} socket={socket} />
            )}

            {activeTab === 'devices' && (authRole === 'owner' || authRole === 'manager') && <IotDevicesPage apiFetch={apiFetch} />}

            {activeTab === 'delivery' && (authRole === 'owner' || authRole === 'manager') && (
              <DeliveryPage apiFetch={apiFetch} orders={orders} onOrderUpdated={handleOrderUpdated} />
            )}

            {activeTab === 'wallet' && (authRole === 'owner' || authRole === 'manager') && (
              <WalletPage apiFetch={apiFetch} authRole={authRole} authName={authName} />
            )}

            {activeTab === 'chats' && <ChatsPage apiFetch={apiFetch} authRole={authRole} myId={myId} socket={socket} />}

            {activeTab === 'team' && authRole !== 'customer' && <TeamChatPage apiFetch={apiFetch} authRole={authRole} myId={myId} />}

            {activeTab === 'smart-ai' && authRole === 'customer' && (
              <SmartAiPage apiFetch={apiFetch} authName={authName} menu={menu} cartApi={cartApi} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
