'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import ChatBubble from '@/components/ChatBubble';
import ChatComposer from '@/components/ChatComposer';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import { jsonBody } from '@/lib/apiClient.js';

// Ported unchanged from react_app/src/pages/TeamChatPage.jsx.
const POLL_MS = 4000;

/**
 * Direct manager<->cook messaging. A manager picks from the full cook
 * roster (via /api/staff, already manager-scoped); a cook picks from the
 * manager list (/api/manager-cook-chat/managers, built for exactly this).
 * No sockets on this channel — polls while a thread is open, same as the
 * Flutter app's manager-cook chat screen.
 */
export default function TeamChatPage({ apiFetch, authRole, myId }) {
  const [overview, setOverview] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { id, name }

  const loadOverview = async () => {
    try {
      const res = await apiFetch('/manager-cook-chat/overview');
      const data = await res.json();
      setOverview(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load team chat overview:', e);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadOverview();
      try {
        if (authRole === 'manager') {
          const res = await apiFetch('/staff');
          const data = await res.json();
          setDirectory((Array.isArray(data) ? data : []).filter((s) => s.role === 'cook'));
        } else {
          const res = await apiFetch('/manager-cook-chat/managers');
          const data = await res.json();
          setDirectory(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('Failed to load team chat directory:', e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authRole]);

  // Keep the conversation list (last message, unread counts) fresh while
  // it's the visible screen — only the open-thread view polled before,
  // so a new incoming message never showed up until you happened to open
  // that specific thread.
  useEffect(() => {
    if (selected) return undefined;
    const id = setInterval(loadOverview, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (selected) {
    return (
      <TeamThreadView
        apiFetch={apiFetch}
        myId={myId}
        otherUserId={selected.id}
        title={selected.name}
        onBack={() => {
          setSelected(null);
          loadOverview();
        }}
      />
    );
  }

  // Merge: existing conversations (sorted by recency) first, then anyone in
  // the directory with no messages yet (sorted by name) — so a manager/cook
  // can always start a brand-new conversation, not just continue old ones.
  const overviewIds = new Set(overview.map((o) => o.otherUserId));
  const unmessaged = directory.filter((d) => !overviewIds.has(d.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{authRole === 'manager' ? 'Chat with Cooks' : 'Chat with Managers'}</h2>
      {loading ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} variants={listVariants} initial="hidden" animate="show">
          {overview.map((row) => {
            const person = directory.find((d) => d.id === row.otherUserId);
            return (
              <motion.div
                key={row.otherUserId}
                className="glass-card staff-row"
                variants={rowVariants}
                whileHover={{ x: 2 }}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected({ id: row.otherUserId, name: person?.name || 'Unknown' })}
              >
                <div className="staff-avatar">{(person?.name || '?')[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{person?.name || 'Unknown'}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.lastMessage}
                  </div>
                </div>
                {row.unreadCount > 0 && <span className="unread-badge">{row.unreadCount}</span>}
              </motion.div>
            );
          })}
          {unmessaged.map((person) => (
            <motion.div
              key={person.id}
              className="glass-card staff-row"
              variants={rowVariants}
              whileHover={{ x: 2 }}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected({ id: person.id, name: person.name })}
            >
              <div className="staff-avatar">{(person.name || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{person.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Say hello 👋</div>
              </div>
            </motion.div>
          ))}
          {overview.length === 0 && unmessaged.length === 0 && (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {authRole === 'manager' ? 'No cooks on staff yet.' : 'No managers on staff yet.'}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function TeamThreadView({ apiFetch, myId, otherUserId, title, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch(`/manager-cook-chat/${otherUserId}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (e) {
      console.error('Failed to load team chat thread:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  const send = async (body) => {
    setSending(true);
    try {
      const res = await apiFetch(`/manager-cook-chat/${otherUserId}/messages`, { method: 'POST', ...jsonBody({ body }) });
      const data = await res.json();
      if (data.id) setMessages((prev) => [...prev, data]);
    } catch (e) {
      console.error('Failed to send team chat message:', e);
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
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No messages yet — say hello 👋</div>
        ) : (
          messages.map((m) => <ChatBubble key={m.id} body={m.body} createdAt={m.createdAt} isMe={m.senderId === myId} />)
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <ChatComposer onSend={send} sending={sending} />
      </div>
    </motion.div>
  );
}
