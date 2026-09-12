// Ported unchanged from react_app/src/components/orbTheme.js. Shared orb
// color language — warm brand amber at rest, rose while listening, a cool
// indigo while processing, brighter gold while speaking.
export const ORB_THEME = {
  idle: {
    gradient: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
    glow: 'rgba(217, 119, 6, 0.35)',
    ring: 'rgba(217, 119, 6, 0.4)'
  },
  listening: {
    gradient: 'linear-gradient(135deg, #fb7185, #e11d48)',
    glow: 'rgba(225, 29, 72, 0.4)',
    ring: 'rgba(225, 29, 72, 0.45)'
  },
  thinking: {
    gradient: 'linear-gradient(135deg, #a5b4fc, #6366f1)',
    glow: 'rgba(99, 102, 241, 0.4)',
    ring: 'rgba(99, 102, 241, 0.4)'
  },
  speaking: {
    gradient: 'linear-gradient(135deg, #fbbf24, #d97706)',
    glow: 'rgba(217, 119, 6, 0.45)',
    ring: 'rgba(217, 119, 6, 0.5)'
  }
};
