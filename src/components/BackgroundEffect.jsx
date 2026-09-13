'use client';

import { useEffect, useRef } from 'react';

// Particle count scales with viewport area rather than being fixed, so a
// phone-sized canvas doesn't pay the same cost as an ultrawide monitor.
const PARTICLE_DENSITY = 16000; // px^2 of viewport per particle
const MIN_PARTICLES = 20;
const MAX_PARTICLES = 80;
const LINK_DISTANCE = 130;
const POINTER_RADIUS = 200;

const hexToRgb = (hex, fallback) => {
  const clean = (hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const readCssColor = (varName, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
  return hexToRgb(value, fallback);
};

// Immersive, low-opacity constellation mesh that drifts on its own and
// gently reacts to the cursor — mounted once in the root layout so it sits
// behind every route. Reads its two colors from the existing --accent-*
// custom properties (rather than hardcoding hex) so it follows tenant
// branding automatically if those variables are ever overridden per-org.
export default function BackgroundEffect() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dotRgb = readCssColor('--accent-secondary', [146, 64, 14]);
    const lineRgb = readCssColor('--accent-primary', [217, 119, 6]);

    let width = 0;
    let height = 0;
    let particles = [];
    let rafId = null;
    let resizeTimer = null;
    let visible = document.visibilityState === 'visible';
    const pointer = { x: -9999, y: -9999, active: false };

    const makeParticles = () => {
      const count = Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, Math.floor((width * height) / PARTICLE_DENSITY)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.6
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeParticles();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < POINTER_RADIUS && dist > 0.01) {
            const force = (1 - dist / POINTER_RADIUS) * 0.035;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= 0.98;
        p.vy *= 0.98;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            const alpha = (1 - dist / LINK_DISTANCE) * 0.14;
            ctx.strokeStyle = `rgba(${lineRgb[0]}, ${lineRgb[1]}, ${lineRgb[2]}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotRgb[0]}, ${dotRgb[1]}, ${dotRgb[2]}, 0.32)`;
        ctx.fill();
      }
    };

    const step = () => {
      if (visible) draw();
      rafId = requestAnimationFrame(step);
    };

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    };
    const handlePointerMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const handlePointerLeave = () => {
      pointer.active = false;
    };
    const handleVisibility = () => {
      visible = document.visibilityState === 'visible';
    };

    resize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibility);

    if (reduceMotion) {
      draw();
    } else {
      rafId = requestAnimationFrame(step);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen" />;
}
