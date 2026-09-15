'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import SmartAiVoiceTab from '@/components/SmartAiVoiceTab';
import SmartAiChatTab from '@/components/SmartAiChatTab';
import MenuItemOptionsModal from '@/components/MenuItemOptionsModal';
import { buildInitialGreeting, timeBasedMenuItems } from '@/lib/menuSuggestions.js';

// Ported unchanged from react_app/src/pages/SmartAiPage.jsx.
/** Short, spoken-only greeting Alex says out loud when the Voice tab first
 * loads — distinct from the rich, chat-history greeting (with suggested
 * items) seeded below, mirroring smart_waiter_screen.dart's
 * _buildSpokenGreeting vs chatbot_notifier.dart's _sendInitialGreeting. */
function buildSpokenGreeting(authName) {
  const hour = new Date().getHours();
  let period;
  if (hour >= 5 && hour < 11) period = 'Good morning';
  else if (hour >= 11 && hour < 16) period = 'Good afternoon';
  else if (hour >= 16 && hour < 23) period = 'Good evening';
  else period = 'Hey there';
  const who = authName ? `, ${authName}` : '';
  return `${period}${who}! I'm Alex, your AI waiter — what can I get started for you today?`;
}

/**
 * The customer's merged "Smart AI" page — one nav entry, one continuous
 * conversation, switchable between hands-free Voice ordering
 * (SmartAiVoiceTab) and text Chat ordering (SmartAiChatTab). This owns the
 * single shared `messages` array so switching tabs never loses the
 * conversation. Both sub-tabs stay mounted at all times (toggled via CSS
 * display, not conditional JSX) so an in-flight SpeechRecognition session in
 * the Voice tab isn't orphaned by unmounting.
 *
 * Also owns the in-chat ordering extras both tabs share: the "customize this
 * item" options modal (opened from either tab's AiChatBubble) and the Place
 * Order / Add More quick actions — mirrors chatbot_notifier.dart, where
 * these live on the one shared ChatbotCubit rather than on either screen.
 */
export default function SmartAiPage({ apiFetch, authName, menu, cartApi }) {
  const [messages, setMessages] = useState(() => [
    { role: 'assistant', timestamp: new Date().toISOString(), ...buildInitialGreeting(authName || 'there', menu) }
  ]);
  const [activeSubTab, setActiveSubTab] = useState('voice');
  const [pendingOptions, setPendingOptions] = useState(null); // {item, quantity}

  // `menu` can still be loading when this page first mounts — once it
  // arrives, backfill the greeting's suggested items instead of leaving it
  // permanently empty (mirrors chatbot_notifier.dart's init() awaiting the
  // menu fetch before building the greeting).
  useEffect(() => {
    if (messages.length !== 1 || messages[0].suggestedItems?.length > 0) return;
    const items = timeBasedMenuItems(menu);
    if (items.length === 0) return;
    setMessages((prev) => [{ ...prev[0], suggestedItems: items }, ...prev.slice(1)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  // Stop any active speech synthesis whenever switching sub-tabs or leaving the page
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeSubTab]);

  const handlePlaceOrderFromChat = async () => {
    if (cartApi.cart.length === 0) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Your cart's empty — tell me what you'd like first!", timestamp: new Date().toISOString() }
      ]);
      return;
    }
    const success = await cartApi.placeCartOrder();
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: success ? "🎉 Order placed! It'll be ready shortly." : "Hmm, I couldn't place that order — please try again.",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const handleAddMore = () => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: "Sure! Here's what else you can add:",
        timestamp: new Date().toISOString(),
        suggestedItems: timeBasedMenuItems(menu)
      }
    ]);
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
      {/* 320px Sticky Left Control Panel */}
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
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>Smart AI Waiter</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Hands-free voice ordering & AI text assistant.
          </p>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Interaction Mode
          </label>
          <SegmentedToggle
            options={[
              { key: 'voice', label: '🎙️ Voice' },
              { key: 'chat', label: '💬 Chat' }
            ]}
            value={activeSubTab}
            onChange={setActiveSubTab}
            style={{ width: '100%' }}
          />
        </div>

        {/* Cart Quick Action */}
        <div
          style={{
            padding: '1rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your Cart
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShoppingCart size={14} /> Items
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cartApi.cartItemCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>${cartApi.cartTotal.toFixed(2)}</span>
          </div>
          {cartApi.cartItemCount > 0 && (
            <button className="btn-orange" onClick={handlePlaceOrderFromChat} style={{ width: '100%', marginTop: '0.25rem', justifyContent: 'center' }}>
              Place Order
            </button>
          )}
        </div>
      </div>

      {/* Right Main Content Panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', flexDirection: 'column', height: '75vh' }}
        >
          <div style={{ flex: 1, minHeight: 0, display: activeSubTab === 'voice' ? 'flex' : 'none', flexDirection: 'column' }}>
            <SmartAiVoiceTab
              apiFetch={apiFetch}
              menu={menu}
              cartApi={cartApi}
              messages={messages}
              setMessages={setMessages}
              initialGreetingText={buildSpokenGreeting(authName || 'there')}
              onSwitchToTab={() => setActiveSubTab('chat')}
              onOpenOptionsPrompt={(item, quantity) => setPendingOptions({ item, quantity })}
              onPlaceOrder={handlePlaceOrderFromChat}
              onAddMore={handleAddMore}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, display: activeSubTab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
            <SmartAiChatTab
              apiFetch={apiFetch}
              menu={menu}
              cartApi={cartApi}
              messages={messages}
              setMessages={setMessages}
              onOpenOptionsPrompt={(item, quantity) => setPendingOptions({ item, quantity })}
              onPlaceOrder={handlePlaceOrderFromChat}
              onAddMore={handleAddMore}
            />
          </div>

          {pendingOptions && (
            <MenuItemOptionsModal
              item={pendingOptions.item}
              onClose={() => setPendingOptions(null)}
              onConfirm={(selectedOptions) => {
                cartApi.addToCart(pendingOptions.item, pendingOptions.quantity, selectedOptions);
                const summary = selectedOptions.length > 0 ? ` (${selectedOptions.map((o) => o.choiceLabel).join(', ')})` : '';
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content: `Added ${pendingOptions.quantity}× ${pendingOptions.item.name}${summary} to your cart 🎉`,
                    timestamp: new Date().toISOString()
                  }
                ]);
                setPendingOptions(null);
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
