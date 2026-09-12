'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';

// Ported unchanged from react_app/src/components/ui/SegmentedToggle.jsx.
/**
 * Sliding-pill segmented control (Customer/Staff on LoginPage, Today/All on
 * OrdersPage, signup/returning, etc). The active button renders the shared
 * `layoutId` pill; framer-motion animates its position/size to the newly
 * active button on every change instead of a hard class swap.
 */
export default function SegmentedToggle({ options, value, onChange, style }) {
  const layoutId = useId();

  return (
    <div className="segmented-toggle" style={style}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={value === opt.key ? 'active' : ''}
          onClick={() => onChange(opt.key)}
          style={{ flex: 1 }}
        >
          {value === opt.key && (
            <motion.div
              layoutId={layoutId}
              className="segmented-pill"
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
