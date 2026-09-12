'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircleOff } from 'lucide-react';
import VoiceOrb from './VoiceOrb';
import AiChatBubble from './AiChatBubble';
import Button from './ui/Button';
import { sendAiTurn, runInteractiveTurn } from '@/lib/aiOrdering.js';

// Ported unchanged from react_app/src/components/SmartAiVoiceTab.jsx.
const SpeechRecognitionApi = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const speechSynthesisApi = typeof window !== 'undefined' ? window.speechSynthesis : null;

const STATE_LABELS = {
  idle: 'Smart Waiter AI Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…'
};

/**
 * Voice-first half of the merged Smart AI page (see SmartAiPage.jsx).
 * Content-only — no outer card/header, those live on the parent so Voice and
 * Chat share one frame/cart badge. Hands-free greet-then-listen loop over
 * the Web Speech API — `messages` is a prop shared with the Chat tab, so
 * switching tabs shows one continuous, real chat history.
 */
export default function SmartAiVoiceTab({
  apiFetch,
  menu,
  cartApi,
  messages,
  setMessages,
  initialGreetingText,
  onSwitchToTab,
  onOpenOptionsPrompt,
  onPlaceOrder,
  onAddMore
}) {
  const supported = Boolean(SpeechRecognitionApi && speechSynthesisApi);
  const [waiterState, setWaiterState] = useState('idle');
  const [speechText, setSpeechText] = useState(initialGreetingText);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);
  const greetedRef = useRef(false);
  const historyListRef = useRef(null);

  // Recursive listen→onresult closures below can't see fresh `messages`
  // props (they were created on an earlier render) — mirror it into a ref so
  // handleFinalTranscript always reads the *current* conversation for the
  // AI's short-term prompt context, not whatever it was on first mount.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (historyListRef.current) historyListRef.current.scrollTop = historyListRef.current.scrollHeight;
  }, [messages]);

  const speak = (text) =>
    new Promise((resolve) => {
      if (!speechSynthesisApi) {
        resolve();
        return;
      }
      speechSynthesisApi.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      utterance.onerror = resolve;
      setWaiterState('speaking');
      speechSynthesisApi.speak(utterance);
    });

  const handleFinalTranscript = async (text) => {
    recognitionRef.current?.stop();
    setWaiterState('thinking');
    const history = messagesRef.current.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    try {
      const result = await sendAiTurn({ apiFetch, menu, cartApi, message: text, history, interactive: false });
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() }]);
      setSpeechText(result.reply);
      await speak(result.reply);
      if (!result.conversationEnded) {
        startListening();
      } else {
        setWaiterState('idle');
      }
    } catch (e) {
      console.error('Smart Waiter AI failed:', e);
      const errorReply = "Sorry, I'm having trouble connecting right now — please try again in a moment.";
      setSpeechText(errorReply);
      await speak(errorReply);
      setWaiterState('idle');
    }
  };

  // A tapped suggestion chip is a deliberate UI action, not a spoken
  // utterance — mirrors flutter_app's chat_message.dart recommendation chip,
  // which always goes through the interactive (options-card-capable) path
  // and never speaks the reply, regardless of which screen it's tapped from.
  const handleQuickOrder = (text) => {
    runInteractiveTurn({ apiFetch, menu, cartApi, message: text, messages: messagesRef.current, setMessages });
  };

  const startListening = () => {
    if (!SpeechRecognitionApi) return;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setWaiterState('listening');
      setLiveTranscript('');
    };
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interim += result[0].transcript;
      }
      setLiveTranscript(finalTranscript || interim);
      if (finalTranscript.trim()) handleFinalTranscript(finalTranscript.trim());
    };
    recognition.onerror = () => {
      setWaiterState('idle');
      setSpeechText("Sorry, I couldn't hear you. Tap the orb to try again.");
    };
    recognition.onend = () => {
      // Silence with no final result — go back to idle instead of hanging.
      setWaiterState((prev) => (prev === 'listening' ? 'idle' : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    if (!supported || greetedRef.current) return;
    greetedRef.current = true;
    (async () => {
      // The greeting is already messages[0] (seeded once by the parent) —
      // just speak it and start listening, no duplicate push here.
      await speak(initialGreetingText);
      startListening();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const handleOrbClick = () => {
    if (waiterState === 'speaking') {
      speechSynthesisApi?.cancel();
      setWaiterState('idle');
      return;
    }
    if (waiterState === 'listening') {
      recognitionRef.current?.stop();
      return;
    }
    startListening();
  };

  if (!supported) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <MessageCircleOff size={40} color="var(--text-muted)" strokeWidth={1.6} />
        <p style={{ color: 'var(--text-secondary)' }}>Voice ordering needs a browser with speech support — try Chrome or Edge.</p>
        <Button variant="primary" onClick={onSwitchToTab}>
          Try Cafe AI (text) instead
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '1.5rem 2rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '0.5rem' }}>
          <VoiceOrb state={waiterState} size={140} onClick={handleOrbClick} />
        </div>

        <AnimatePresence mode="wait">
          <motion.strong
            key={waiterState}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ color: 'var(--text-primary)', letterSpacing: '0.01em' }}
          >
            {STATE_LABELS[waiterState]}
          </motion.strong>
        </AnimatePresence>

        {/* Transient, local-only feedback (mic errors, "couldn't hear you")
            that never gets pushed into the shared chat history below —
            hidden once it just echoes the last reply already in that list. */}
        {speechText && speechText !== initialGreetingText && waiterState === 'idle' && (
          <motion.p
            key={speechText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', margin: 0, maxWidth: '28rem' }}
          >
            {speechText}
          </motion.p>
        )}

        {waiterState === 'listening' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)', fontSize: '0.85rem', minHeight: '1.2rem' }}
          >
            {liveTranscript || 'listening…'}
          </motion.div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
          Tap the orb to {waiterState === 'listening' ? 'stop & submit' : waiterState === 'speaking' ? 'interrupt' : 'speak your order'}.
        </p>
      </div>

      {/* Real, scrollable conversation transcript — the exact same shared
          `messages` list and AiChatBubble the Chat tab renders (suggestion
          chips, "customize" cards and quick actions included), so "what I
          said" vs "what Alex answered" is always visible here too, and
          switching tabs shows one continuous history instead of a reset. */}
      <div ref={historyListRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem 1rem' }}>
        {messages.map((m, i) => (
          <AiChatBubble
            key={i}
            message={m}
            isLatest={i === messages.length - 1}
            cartHasItems={cartApi.cart.length > 0}
            onQuickOrder={handleQuickOrder}
            onOpenOptionsPrompt={onOpenOptionsPrompt}
            onPlaceOrder={onPlaceOrder}
            onAddMore={onAddMore}
          />
        ))}
      </div>
    </div>
  );
}
