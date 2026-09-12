'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import AiChatBubble from './AiChatBubble';
import ChatComposer from './ChatComposer';
import TypingIndicator from './TypingIndicator';
import { runInteractiveTurn } from '@/lib/aiOrdering.js';

// Ported unchanged from react_app/src/components/SmartAiChatTab.jsx.
const SpeechRecognitionApi = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const speechSynthesisApi = typeof window !== 'undefined' ? window.speechSynthesis : null;

/**
 * Text-first half of the merged Smart AI page (see SmartAiPage.jsx).
 * Content-only — no outer card/header, those live on the parent so Voice and
 * Chat share one frame/cart badge. Same sendAiTurn() engine as the Voice
 * tab, but `messages` is a prop shared between them, and each turn renders
 * via AiChatBubble so suggested-item chips / "customize" cards / quick
 * actions match the mobile app instead of plain text bubbles.
 */
export default function SmartAiChatTab({ apiFetch, menu, cartApi, messages, setMessages, onOpenOptionsPrompt, onPlaceOrder, onAddMore }) {
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping]);

  const send = async (text) => {
    setIsTyping(true);
    try {
      await runInteractiveTurn({ apiFetch, menu, cartApi, message: text, messages, setMessages });
    } finally {
      setIsTyping(false);
    }
  };

  const handleMic = () => {
    if (!SpeechRecognitionApi) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) send(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const speakMenu = () => {
    if (!menu || menu.length === 0) return;
    const topItems = menu.slice(0, 10);

    if (speechSynthesisApi) {
      const intro = 'Welcome to Smart Cafe! Here is our complete menu: ';
      const spoken = topItems.map((item) => `${item.name} for $${item.price.toFixed(2)}`).join(', ');
      speechSynthesisApi.cancel();
      speechSynthesisApi.speak(new SpeechSynthesisUtterance(`${intro} ${spoken}.`));
    }

    // Also show it, not just speak it — a horizontal scroll of small menu
    // cards in the chat itself, same as tapping any other suggestion row.
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: "Here's our full menu 📋 — tap anything to add it:",
        timestamp: new Date().toISOString(),
        suggestedItems: topItems
      }
    ]);
  };

  const cartHasItems = cartApi.cart.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {menu && menu.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.6rem 1rem 0' }}>
          <button
            type="button"
            className="toggle-button"
            onClick={speakMenu}
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Volume2 size={14} /> Speak Menu
          </button>
        </div>
      )}

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {messages.map((m, i) => (
          <AiChatBubble
            key={i}
            message={m}
            isLatest={i === messages.length - 1}
            cartHasItems={cartHasItems}
            onQuickOrder={send}
            onOpenOptionsPrompt={onOpenOptionsPrompt}
            onPlaceOrder={onPlaceOrder}
            onAddMore={onAddMore}
          />
        ))}
        {isTyping && <TypingIndicator senderLabel="Alex" />}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.25rem', paddingLeft: '0.5rem' }}>
        {SpeechRecognitionApi && (
          <button
            type="button"
            onClick={handleMic}
            className="icon-btn"
            style={isListening ? { background: 'rgba(220, 38, 38, 0.1)', color: '#b91c1c', borderColor: 'rgba(220, 38, 38, 0.3)' } : undefined}
            title={isListening ? 'Stop listening' : 'Speak your order'}
          >
            {isListening ? <Square size={15} /> : <Mic size={15} />}
          </button>
        )}
        <div style={{ flex: 1 }}>
          <ChatComposer onSend={send} sending={isTyping} />
        </div>
      </div>
    </div>
  );
}
