'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle } from 'lucide-react';
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

  useEffect(() => {
    if (selected) return undefined;
    const id = setInterval(loadOverview, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Merge: existing conversations (sorted by recency) first, then anyone in
  // the directory with no messages yet (sorted by name) — so a manager/cook
  // can always start a brand-new conversation, not just continue old ones.
  const overviewIds = new Set(overview.map((o) => o.otherUserId));
  const unmessaged = directory.filter((d) => !overviewIds.has(d.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: 1400, margin: '0 auto', alignItems: 'flex-start' }}>
      {/* Left Sidebar Control Panel (320px Sticky) */}
      <div
        className="glass-card"
        style={{
          width: 320,
          flexShrink: 0,
          position: 'sticky',
          top: '1.5rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          maxHeight: 'calc(100vh - 3rem)',
          overflowY: 'auto'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageCircle size={22} color="var(--accent-primary)" /> {authRole === 'manager' ? 'Chat with Cooks' : 'Chat with Managers'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
            Direct team messaging between kitchen cooks and store management.
          </p>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {loading ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading staff roster…</div>
        ) : (
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} variants={listVariants} initial="hidden" animate="show">
            {overview.map((row) => {
              const person = directory.find((d) => d.id === row.otherUserId);
              const isSelected = selected?.id === row.otherUserId;
              return (
                <motion.div
                  key={row.otherUserId}
                  className="glass-card staff-row"
                  variants={rowVariants}
                  whileHover={{ x: 2 }}
                  style={{
                    cursor: 'pointer',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                  }}
                  onClick={() => setSelected({ id: row.otherUserId, name: person?.name || 'Unknown' })}
                >
                  <div className="staff-avatar">{(person?.name || '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>{person?.name || 'Unknown'}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.lastMessage}
                    </div>
                  </div>
                  {row.unreadCount > 0 && <span className="unread-badge">{row.unreadCount}</span>}
                </motion.div>
              );
            })}
            {unmessaged.map((person) => {
              const isSelected = selected?.id === person.id;
              return (
                <motion.div
                  key={person.id}
                  className="glass-card staff-row"
                  variants={rowVariants}
                  whileHover={{ x: 2 }}
                  style={{
                    cursor: 'pointer',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                  }}
                  onClick={() => setSelected({ id: person.id, name: person.name })}
                >
                  <div className="staff-avatar">{(person.name || '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>{person.name}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Say hello 👋</div>
                  </div>
                </motion.div>
              );
            })}
            {overview.length === 0 && unmessaged.length === 0 && (
              <div className="glass-card" style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {authRole === 'manager' ? 'No cooks on staff yet.' : 'No managers on staff yet.'}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Main Right Content Panel (Team Chat Stream) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selected ? (
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
        ) : (
          <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <MessageCircle size={36} strokeWidth={1.5} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Select a Team Member</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: 380 }}>Choose a team member from the left sidebar roster to start messaging.</p>
          </div>
        )}
      </div>
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
