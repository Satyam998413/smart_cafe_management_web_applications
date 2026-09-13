// M3-expressive motion presets for Framer Motion — the JS-side half of the
// design system. Colors/shape/elevation live as CSS variables in
// globals.css instead (see the @theme / @theme inline blocks there); spring
// physics configs have no CSS equivalent, so they live here. Not to be
// confused with src/lib/themePresets.js, which holds per-organization
// branding color presets, a separate concept.
export const springs = {
  // Nav pill / tab indicators — quick, slightly bouncy settle.
  snappy: { type: 'spring', stiffness: 500, damping: 34 },
  // Page/tab content transitions.
  page: { type: 'spring', stiffness: 300, damping: 32, mass: 0.8 },
  // Tilt-card rotation — light and fast so it tracks the pointer closely.
  tilt: { type: 'spring', stiffness: 300, damping: 20, mass: 0.5 },
  // Tilt-card hover scale / shadow settle — a touch softer than the tilt itself.
  gentle: { type: 'spring', stiffness: 170, damping: 20 }
};
