'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Mic, Sparkles } from 'lucide-react';
import { ORB_THEME as STATE_THEME } from './orbTheme';

// A 1:1 visual/animation port of flutter_app's
// smart_ai_voice_tab.dart _buildSuperNaturalAIAvatar — same three concentric
// layers, same per-state colors (orbTheme.js's `core`), same motion:
//   1. outer rotating halo ring with one glowing marker dot
//   2. middle pulsing energy field (scale 1 -> 1.25, only while
//      listening/speaking)
//   3. inner radial-gradient core sphere, whose center shows a mic/sparkle
//      icon, five static-height bars (speaking), or three orbiting dots
//      (thinking)
// plus the whole orb bouncing vertically while speaking. Every dimension
// below is `size * <ratio>`, using the exact ratios of Flutter's 150px orb,
// so this matches at any `size`. Purely presentational — driven by `state`,
// no voice/recognition logic lives here.
const ROTATE_PERIOD_S = { listening: 8, speaking: 8, thinking: 1.1 };
const BAR_HEIGHT_RATIOS = [28 / 150, 16 / 150, 28 / 150, 16 / 150, 28 / 150];

export default function VoiceOrb({ state = 'idle', size = 150, onClick, onDoubleClick }) {
  const theme = STATE_THEME[state] || STATE_THEME.idle;
  const reduceMotion = useReducedMotion();
  const pulseActive = state === 'listening' || state === 'speaking';
  const spinning = state !== 'idle';
  const bouncing = state === 'speaking' && !reduceMotion;

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label={`Smart Waiter voice assistant — ${state}`}
      style={{ position: 'relative', width: size, height: size, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
    >
      <motion.div
        style={{ position: 'relative', width: '100%', height: '100%' }}
        animate={bouncing ? { y: [0, -size * 0.0933, 0] } : { y: 0 }}
        transition={bouncing ? { duration: 0.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' } : { duration: 0.2 }}
      >
        {/* Outer rotating halo ring + marker dot */}
        <motion.div
          style={{ position: 'absolute', inset: size * 0.0167, borderRadius: '50%', border: `1.5px solid ${theme.core}66` }}
          animate={!reduceMotion && spinning ? { rotate: 360 } : { rotate: 0 }}
          transition={
            !reduceMotion && spinning
              ? { duration: ROTATE_PERIOD_S[state] ?? 8, repeat: Infinity, ease: 'linear' }
              : { duration: 0.2 }
          }
        >
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: size * 0.0667,
              height: size * 0.0667,
              borderRadius: '50%',
              background: theme.core,
              boxShadow: `0 0 ${size * 0.0533}px ${size * 0.0133}px ${theme.core}`
            }}
          />
        </motion.div>

        {/* Middle pulsing energy field */}
        <motion.div
          style={{
            position: 'absolute',
            inset: size * 0.1167,
            borderRadius: '50%',
            background: `${theme.core}1F`,
            border: `2px solid ${theme.core}99`,
            boxShadow: `0 0 ${size * 0.2133}px ${size * 0.0267}px ${theme.core}66`
          }}
          animate={!reduceMotion && pulseActive ? { scale: [1, 1.25] } : { scale: 1 }}
          transition={
            !reduceMotion && pulseActive
              ? { duration: 1.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        />

        {/* Inner glassmorphism core sphere */}
        <div
          style={{
            position: 'absolute',
            inset: size * 0.2,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${theme.core} 40%, ${theme.core}CC 70%, #000 100%)`,
            boxShadow: `0 0 ${size * 0.16}px ${size * 0.0133}px ${theme.core}99`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {state === 'speaking' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.0333 }}>
              {BAR_HEIGHT_RATIOS.map((r, i) => (
                <span
                  key={i}
                  style={{ width: size * 0.0267, height: size * r, borderRadius: size * 0.0267, background: '#000' }}
                />
              ))}
            </div>
          ) : state === 'thinking' ? (
            <motion.div
              style={{ position: 'relative', width: '100%', height: '100%' }}
              animate={!reduceMotion ? { rotate: 360 } : { rotate: 0 }}
              transition={!reduceMotion ? { duration: 1.1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
            >
              {[0, 1, 2].map((i) => {
                const angle = (i * 2 * Math.PI) / 3;
                const r = size * 0.1333;
                return (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: size * 0.06,
                      height: size * 0.06,
                      borderRadius: '50%',
                      background: `rgba(0,0,0,${0.35 + 0.22 * i})`,
                      transform: `translate(-50%, -50%) translate(${r * Math.cos(angle)}px, ${r * Math.sin(angle)}px)`
                    }}
                  />
                );
              })}
            </motion.div>
          ) : (
            (() => {
              const Icon = state === 'listening' ? Mic : Sparkles;
              return <Icon size={size * 0.253} color="#000" strokeWidth={2} />;
            })()
          )}
        </div>
      </motion.div>
    </button>
  );
}
