'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { springs } from '@/lib/motionTokens';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Spatial hover primitive for the dashboard's stat/summary cards — tilts
// toward the pointer on a spring and layers a second, direction-matched
// shadow underneath for depth, without ever touching layout-affecting
// properties (only transform + box-shadow), so nothing shifts.
export default function TiltCard({ children, className = '', wrapperClassName = '', maxTilt = 8, springPreset = 'tilt', ...rest }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const springConfig = springs[springPreset] ?? springs.tilt;

  const rotateXRaw = useMotionValue(0);
  const rotateYRaw = useMotionValue(0);
  const rotateX = useSpring(rotateXRaw, springConfig);
  const rotateY = useSpring(rotateYRaw, springConfig);
  const scale = useSpring(1, springs.gentle);

  const shadowOffsetX = useTransform(rotateY, (v) => v * -1.6);
  const shadowOffsetY = useTransform(rotateX, (v) => v * 1.6);
  const boxShadow = useTransform(
    [shadowOffsetX, shadowOffsetY],
    ([sx, sy]) =>
      `${sx}px ${10 + sy}px 28px rgba(28, 25, 23, 0.16), ${sx * 0.5}px ${4 + sy * 0.5}px 10px rgba(28, 25, 23, 0.1)`
  );

  const handleMouseMove = (event) => {
    if (reduceMotion || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width;
    const py = (event.clientY - bounds.top) / bounds.height;
    rotateYRaw.set(clamp((px - 0.5) * 2 * maxTilt, -maxTilt, maxTilt));
    rotateXRaw.set(clamp(-(py - 0.5) * 2 * maxTilt, -maxTilt, maxTilt));
    scale.set(1.02);
  };

  const handleMouseLeave = () => {
    rotateXRaw.set(0);
    rotateYRaw.set(0);
    scale.set(1);
  };

  return (
    // display: grid on the wrapper (rather than the default block) makes its
    // one child stretch to fill both axes, so wrapping a grid/flex item's
    // card in this extra perspective layer doesn't break the parent grid's
    // own stretch-to-equal-height behavior.
    <div style={{ perspective: 1200, display: 'grid' }} className={wrapperClassName}>
      <motion.div
        ref={ref}
        className={className}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={reduceMotion ? undefined : { rotateX, rotateY, scale, boxShadow, transformStyle: 'preserve-3d' }}
        {...rest}
      >
        {children}
      </motion.div>
    </div>
  );
}
