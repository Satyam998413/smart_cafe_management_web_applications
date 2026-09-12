'use client';

import { motion } from 'framer-motion';
import { OrbStatus } from './MiniOrb';

// Ported unchanged from react_app/src/components/ui/Button.jsx.
const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
    color: 'var(--text-on-accent)',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-accent)'
  },
  secondary: {
    background: 'var(--bg-surface-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    boxShadow: 'none'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    boxShadow: 'none'
  },
  danger: {
    background: 'rgba(220, 38, 38, 0.1)',
    color: '#b91c1c',
    border: '1px solid rgba(220, 38, 38, 0.3)',
    boxShadow: 'none'
  }
};

const SIZES = {
  sm: { padding: '0.45rem 0.9rem', fontSize: '0.8rem' },
  md: { padding: '0.65rem 1.25rem', fontSize: '0.9rem' },
  lg: { padding: '0.85rem 1.5rem', fontSize: '1rem' }
};

const ORB_SIZES = { sm: 13, md: 15, lg: 17 };

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  style,
  children,
  ...rest
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.primary;
  const sizeStyle = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { y: -1, scale: 1.015 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        ...variantStyle,
        ...sizeStyle,
        borderRadius: 'var(--radius-md)',
        fontWeight: 600,
        fontFamily: 'var(--font-family)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        width: fullWidth ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        whiteSpace: 'nowrap',
        ...style
      }}
      {...rest}
    >
      {loading ? <OrbStatus label={children} size={ORB_SIZES[size] || ORB_SIZES.md} gap="0.45rem" /> : children}
    </motion.button>
  );
}
