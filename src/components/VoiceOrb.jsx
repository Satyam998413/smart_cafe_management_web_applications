'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Coffee, Mic, Sparkles, Volume2 } from 'lucide-react';
import { ORB_THEME as STATE_THEME } from './orbTheme';

// Ported unchanged from react_app/src/components/VoiceOrb.jsx.
const ICONS = { idle: Coffee, listening: Mic, thinking: Sparkles, speaking: Volume2 };
const RING_COUNT = 3;
const EQ_BARS = 5;

/**
 * The Smart Waiter's animated presence — a single orb whose color, motion
 * and center glyph change per conversational state (idle/listening/
 * thinking/speaking). Purely presentational: driven by the `state` prop,
 * no voice/recognition logic lives here.
 */
export default function VoiceOrb({ state = 'idle', size = 180, onClick }) {
  const theme = STATE_THEME[state] || STATE_THEME.idle;
  const Icon = ICONS[state] || Coffee;
  const active = state === 'listening' || state === 'speaking';
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Smart Waiter voice assistant — ${state}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {!reduceMotion && (
        <AnimatePresence>
          {active &&
            Array.from({ length: RING_COUNT }).map((_, i) => (
              <motion.span
                key={`${state}-ring-${i}`}
                style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${theme.ring}` }}
                initial={{ scale: 0.75, opacity: 0.6 }}
                animate={{
                  scale: 1.65,
                  opacity: 0,
                  transition: {
                    duration: state === 'speaking' ? 1.4 : 1.8,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: i * (state === 'speaking' ? 0.35 : 0.5)
                  }
                }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
              />
            ))}
        </AnimatePresence>
      )}

      {!reduceMotion && state === 'thinking' && (
        <motion.div style={{ position: 'absolute', inset: 0 }} animate={{ rotate: 360 }} transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}>
          {[0, 120, 240].map((deg) => (
            <span
              key={deg}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: theme.ring,
                boxShadow: `0 0 8px ${theme.ring}`,
                transform: `rotate(${deg}deg) translate(${size * 0.48}px) translate(-50%, -50%)`
              }}
            />
          ))}
        </motion.div>
      )}

      <motion.div
        animate={
          reduceMotion
            ? { scale: 1 }
            : state === 'idle'
              ? { scale: [1, 1.045, 1] }
              : state === 'speaking'
                ? { scale: [1, 1.06, 0.98, 1.03, 1] }
                : { scale: 1 }
        }
        transition={
          state === 'idle'
            ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
            : state === 'speaking'
              ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 }
        }
        style={{
          position: 'relative',
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: '50%',
          background: theme.gradient,
          boxShadow: `0 0 ${Math.round(size * 0.35)}px ${theme.glow}, 0 14px 32px rgba(28, 25, 23, 0.2)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {!reduceMotion && (
          <span
            style={{
              position: 'absolute',
              inset: '-40%',
              background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.3), transparent 35%)',
              animation: 'spinSlow 6s linear infinite'
            }}
          />
        )}

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key={`${state}-eq`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {Array.from({ length: EQ_BARS }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: size * 0.26,
                    borderRadius: 3,
                    background: 'var(--text-on-accent)',
                    opacity: 0.92,
                    transformOrigin: 'center',
                    animation: `eqBar ${state === 'speaking' ? 0.55 : 0.9}s ease-in-out infinite`,
                    animationDelay: `${i * 0.11}s`
                  }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={`${state}-icon`}
              initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ position: 'relative', zIndex: 1, color: 'var(--text-on-accent)', display: 'flex' }}
            >
              <Icon size={Math.round(size * 0.32)} strokeWidth={1.8} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}
