'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Mic, Sparkles } from 'lucide-react';
import { ORB_THEME as STATE_THEME } from './orbTheme';

// A 1:1 visual/animation port of flutter_app's
// smart_ai_voice_tab.dart _buildSuperNaturalAIAvatar — same four concentric
// layers, same per-state colors (orbTheme.js's `core`), same motion:
//   1. a sonar ping ring, only while listening — expands and fades on a
//      loop distinct from the halo/pulse below, the one piece of motion
//      unique to "I'm capturing audio right now"
//   2. outer rotating halo ring with one glowing marker dot
//   3. middle pulsing energy field (scale 1 -> 1.25 while listening/
//      speaking; a slower, gentler breathing scale at every other state
//      including idle, so the orb is never fully static)
//   4. inner radial-gradient core sphere, whose center shows a mic/sparkle
//      icon, five independently-animated equalizer bars (speaking), or
//      three orbiting dots over a softly breathing core (thinking)
// plus the whole orb bouncing vertically while speaking, and every
// color/glow crossfading over CROSSFADE_MS instead of snapping the instant
// `state` changes, via each layer's own CSS `transition`. Every dimension
// below is `size * <ratio>`, using the exact ratios of Flutter's 150px orb,
// so this matches at any `size`. Purely presentational — driven by `state`,
// no voice/recognition logic lives here.
const ROTATE_PERIOD_S = { listening: 8, speaking: 8, thinking: 1.1 };
const BAR_BASE_HEIGHT_RATIOS = [28 / 150, 16 / 150, 28 / 150, 16 / 150, 28 / 150];
const CROSSFADE_MS = 420;
const COLOR_TRANSITION = `background ${CROSSFADE_MS}ms ease, border-color ${CROSSFADE_MS}ms ease, box-shadow ${CROSSFADE_MS}ms ease`;

export default function VoiceOrb({ state = 'idle', size = 150, onClick, onDoubleClick }) {
  const theme = STATE_THEME[state] || STATE_THEME.idle;
  const reduceMotion = useReducedMotion();
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const pulseActive = isListening || isSpeaking;
  const spinning = state !== 'idle';
  const bouncing = isSpeaking && !reduceMotion;

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
        animate={
          bouncing
            ? { y: [0, -size * 0.0933, 0], scale: 1, opacity: 1 }
            : !reduceMotion && state === 'idle'
              ? { y: 0, scale: [1, 1.03, 1], opacity: [1, 0.92, 1] }
              : { y: 0, scale: 1, opacity: 1 }
        }
        transition={
          bouncing
            ? { duration: 0.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
            : !reduceMotion && state === 'idle'
              ? { duration: 3.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
              : { duration: 0.2 }
        }
      >
        {/* Sonar ping — expands and fades on its own loop, listening only */}
        <motion.div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: size * 0.0167,
            borderRadius: '50%',
            border: `1.5px solid ${theme.core}`,
            pointerEvents: 'none'
          }}
          animate={!reduceMotion && isListening ? { scale: [1, 1.35], opacity: [0.55, 0] } : { scale: 1, opacity: 0 }}
          transition={
            !reduceMotion && isListening
              ? { duration: 1.8, repeat: Infinity, ease: 'easeOut' }
              : { duration: 0.2 }
          }
        />

        {/* Outer rotating halo ring + marker dot */}
        <motion.div
          style={{
            position: 'absolute',
            inset: size * 0.0167,
            borderRadius: '50%',
            border: `1.5px solid ${theme.core}66`,
            transition: COLOR_TRANSITION
          }}
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
              boxShadow: `0 0 ${size * 0.0533}px ${size * 0.0133}px ${theme.core}`,
              transition: COLOR_TRANSITION
            }}
          />
        </motion.div>

        {/* Middle pulsing energy field — bigger swings while listening/
            speaking, a slow gentle breath otherwise (including idle) */}
        <motion.div
          style={{
            position: 'absolute',
            inset: size * 0.1167,
            borderRadius: '50%',
            background: `${theme.core}1F`,
            border: `2px solid ${theme.core}99`,
            boxShadow: `0 0 ${size * 0.2133}px ${size * 0.0267}px ${theme.core}66`,
            transition: COLOR_TRANSITION
          }}
          animate={reduceMotion ? { scale: 1 } : { scale: pulseActive ? [1, 1.25] : [1, 1.06] }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : { duration: pulseActive ? 1.4 : 2.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
          }
        />

        {/* Inner glassmorphism core sphere */}
        <motion.div
          style={{
            position: 'absolute',
            inset: size * 0.2,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${theme.core} 40%, ${theme.core}CC 70%, #000 100%)`,
            boxShadow: `0 0 ${size * 0.16}px ${size * 0.0133}px ${theme.core}99`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: COLOR_TRANSITION
          }}
          animate={!reduceMotion && isThinking ? { scale: [1, 1.05] } : { scale: 1 }}
          transition={
            !reduceMotion && isThinking
              ? { duration: 0.9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        >
          {isSpeaking ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.0333, height: size * BAR_BASE_HEIGHT_RATIOS[0] }}>
              {BAR_BASE_HEIGHT_RATIOS.map((r, i) => (
                <motion.span
                  key={i}
                  style={{
                    width: size * 0.0267,
                    height: size * r,
                    borderRadius: size * 0.0267,
                    background: '#000',
                    transformOrigin: 'center'
                  }}
                  animate={!reduceMotion ? { scaleY: [1, 1.55, 0.55, 1.25, 1] } : { scaleY: 1 }}
                  transition={
                    !reduceMotion
                      ? { duration: 0.85 + i * 0.05, repeat: Infinity, ease: 'easeInOut', delay: i * 0.11 }
                      : { duration: 0.2 }
                  }
                />
              ))}
            </div>
          ) : isThinking ? (
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
              const Icon = isListening ? Mic : Sparkles;
              return <Icon size={size * 0.253} color="#000" strokeWidth={2} />;
            })()
          )}
        </motion.div>
      </motion.div>
    </button>
  );
}
