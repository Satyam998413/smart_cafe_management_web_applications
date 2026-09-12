'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ORB_THEME } from '../orbTheme';

// Ported unchanged from react_app/src/components/ui/MiniOrb.jsx.
export default function MiniOrb({ size = 18, tone = 'thinking' }) {
  const theme = ORB_THEME[tone] || ORB_THEME.thinking;
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      animate={reduceMotion ? undefined : { scale: [1, 1.22, 1], opacity: [0.85, 1, 0.85] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: theme.gradient,
        boxShadow: `0 0 ${Math.round(size * 0.9)}px ${theme.glow}`,
        flexShrink: 0
      }}
    />
  );
}

/** MiniOrb + label, the standard "orb with the action name beside it" pairing. */
export function OrbStatus({ label, tone = 'thinking', size = 16, gap = '0.5rem' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <MiniOrb size={size} tone={tone} />
      {label}
    </span>
  );
}
