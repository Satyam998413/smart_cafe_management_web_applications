'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import ChatBubble from '@/components/ChatBubble';
import ChatComposer from '@/components/ChatComposer';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import { jsonBody, todayIso } from '@/lib/apiClient.js';

// Ported unchanged from react_app/src/pages/ChatsPage.jsx.
/**
 * Cook: their customer threads (one per customer they've ever claimed an
 * order for) — read/write, day-paginated like the Flutter app.
 * Manager: read-only oversight of every customer<->cook conversation —
 * never marks anything read, mirrors chatController's separation.
 *
 * [socket] is the single shared connection from the dashboard shell (mirrors
 * the Flutter app's SocketDatasource) — every live update on this page
 * rides that one socket's `chat_message` event, the same event name/payload
 * the Flutter app listens for.
 */
export default function ChatsPage({ apiFetch, authRole, myId, socket }) {
  return authRole === 'manager' ? (
    <ManagerOversight apiFetch={apiFetch} socket={socket} />
  ) : (
    <CookThreads apiFetch={apiFetch} myId={myId} socket={socket} isCustomer={authRole === 'customer'} />
  );
}

// Doubles as a customer's "My Chat" (thread list has at most one row — their
// own) and a cook's customer-thread list (one row per customer they've ever
// claimed an order for) — the server already scopes /chats/threads and
// isAuthorizedForThread per-role, so only the copy differs here.
function CookThreads({ apiFetch, myId, socket, isCustomer }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { userId, otherParty }

  const loadThreads = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/chats/threads');
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e) {
      console.error('Failed to load chat threads:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any chat_message (on any thread) — just reload the list, same as the
  // Flutter app's ChatThreadsNotifier: the list is small enough that a full
  // reload is simpler and just as correct as patching one row in place.
  useEffect(() => {
    if (!socket) return undefined;
    const handler = () => loadThreads();
    socket.on('chat_message', handler);
    return () => socket.off('chat_message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  if (selected) {
    return (
      <ThreadView
        apiFetch={apiFetch}
        socket={socket}
        myId={myId}
        userId={selected.userId}
        title={selected.otherParty?.name || (isCustomer ? 'Your cook' : 'Customer')}
        readOnly={false}
        onBack={() => {
          setSelected(null);
          loadThreads();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{isCustomer ? 'My Chat' : 'Customer Chats'}</h2>
      {loading ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : threads.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
        >
          <MessageCircle size={28} strokeWidth={1.5} />
          {isCustomer ? "Your order's cook will message you here once they claim your order." : 'No conversations yet — claim an order to start one.'}
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} variants={listVariants} initial="hidden" animate="show">
          {threads.map((t) => (
            <motion.div
              key={t.userId}
              className="glass-card staff-row"
              variants={rowVariants}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(t)}
              whileHover={{ x: 2 }}
            >
              <div className="staff-avatar">{(t.otherParty?.name || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{t.otherParty?.name || (isCustomer ? 'Your cook' : 'Customer')}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.lastMessage?.body || 'Say hello 👋'}
                </div>
              </div>
              {t.unreadCount > 0 && <span className="unread-badge">{t.unreadCount}</span>}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ManagerOversight({ apiFetch, socket }) {
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { userId, userName, cookName }

  const loadOverview = async () => {
    try {
      const res = await apiFetch('/manager/chats/overview');
      const data = await res.json();
      setOverview(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load chat oversight:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch]);

  // Requires the server to include 'role-manager' as an emit target on
  // every chat_message (chats sendMessage / claim route's
  // postClaimAutoMessages) — a manager is never the customer/cook
  // recipient, so without that room they'd never receive this event at all.
  useEffect(() => {
    if (!socket) return undefined;
    const handler = () => loadOverview();
    socket.on('chat_message', handler);
    return () => socket.off('chat_message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  if (selected) {
    return (
      <ThreadView
        apiFetch={apiFetch}
        socket={socket}
        userId={selected.userId}
        title={`${selected.userName} ↔ ${selected.cookName || 'unassigned'}`}
        readOnly
        managerView
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Chat Oversight (read-only)</h2>
      {loading ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : overview.length === 0 ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No customer conversations yet.
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} variants={listVariants} initial="hidden" animate="show">
          {overview.map((row) => (
            <motion.div
              key={`${row.userId}-${row.cookId || 'none'}`}
              className="glass-card staff-row"
              variants={rowVariants}
              whileHover={{ x: 2 }}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(row)}
            >
              <div className="staff-avatar">{(row.userName || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{row.userName}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>↔</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.cookName || 'unassigned'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.lastMessage}
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.messageCount} msgs</span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

/**
 * One thread's messages, day-paginated (default today, "Load earlier" goes
 * back one calendar day at a time — same cursor the Flutter app uses).
 * [readOnly]/[managerView] route to the manager's non-mutating oversight
 * endpoint instead of the cook's read/write one.
 *
 * Live updates: joins the `chat-<userId>` socket room (server verifies
 * participancy) and appends any chat_message that belongs to this thread,
 * deduping by id since the sender's own message already lands optimistically
 * from the POST response.
 */
function ThreadView({ apiFetch, socket, myId, userId, title, readOnly, managerView, onBack }) {
  const [messages, setMessages] = useState([]);
  const [date, setDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);

  const basePath = managerView ? `/manager/chats/${userId}/messages` : `/chats/${userId}/messages`;

  const loadToday = async () => {
    setLoading(true);
    const today = todayIso();
    setDate(today);
    setHasMore(true);
    try {
      const res = await apiFetch(`${basePath}?date=${today}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Failed to load thread:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('join-chat-room', userId);
    const handler = (data) => {
      if (!data || data.userId !== userId) return;
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    };
    socket.on('chat_message', handler);
    return () => {
      socket.emit('leave-chat-room', userId);
      socket.off('chat_message', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, userId]);

  const loadOlder = async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const prev = new Date(date + 'T00:00:00.000Z');
      prev.setUTCDate(prev.getUTCDate() - 1);
      const prevIso = prev.toISOString().slice(0, 10);
      const res = await apiFetch(`${basePath}?date=${prevIso}`);
      const data = await res.json();
      const older = data.messages || [];
      setMessages((prevMsgs) => [...older, ...prevMsgs]);
      setDate(prevIso);
      const daysBack = Math.round((new Date(todayIso()) - new Date(prevIso)) / 86400000);
      setHasMore(daysBack < 60);
    } catch (e) {
      console.error('Failed to load older messages:', e);
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (body) => {
    setSending(true);
    try {
      const res = await apiFetch(basePath, { method: 'POST', ...jsonBody({ body }) });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <button className="icon-btn" onClick={onBack} title="Back">
          <ArrowLeft size={16} />
        </button>
        <strong style={{ color: 'var(--text-primary)' }}>{title}</strong>
        {readOnly && (
          <span className="role-badge role-manager" style={{ marginLeft: 'auto' }}>
            read-only
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {hasMore && (
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <button className="toggle-button" onClick={loadOlder} disabled={loadingOlder} style={{ fontSize: '0.8rem', padding: '0.35rem 0.9rem' }}>
              {loadingOlder ? 'Loading…' : '↑ Load earlier messages'}
            </button>
          </div>
        )}
        {!hasMore && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>Beginning of conversation</div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No messages on {date}.</div>
        ) : (
          messages.map((m) => <ChatBubble key={m.id} body={m.body} createdAt={m.createdAt} isMe={!managerView && m.senderId === myId} />)
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <ChatComposer onSend={send} sending={sending} disabled={readOnly} disabledHint="Managers have read-only access to customer chats." />
      </div>
    </motion.div>
  );
}
