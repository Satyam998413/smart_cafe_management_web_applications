'use client';

export const GOOGLE_HEADER_FONTS = [
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Default Display)' },
  { id: 'Outfit', label: 'Outfit (Modern Geometric)' },
  { id: 'Poppins', label: 'Poppins (Vibrant Sans)' },
  { id: 'Inter', label: 'Inter (Clean Technical)' },
  { id: 'Space Grotesk', label: 'Space Grotesk (Tech Monospace Display)' },
  { id: 'Syne', label: 'Syne (Expressive Art)' },
  { id: 'Sora', label: 'Sora (Futuristic UI)' },
  { id: 'Bricolage Grotesque', label: 'Bricolage Grotesque (Bold Character)' },
  { id: 'Playfair Display', label: 'Playfair Display (Luxury Serif)' },
  { id: 'Montserrat', label: 'Montserrat (Classic Display)' },
  { id: 'Lexend', label: 'Lexend (Clean Reading)' },
  { id: 'Cinzel', label: 'Cinzel (Cinematic Serif)' }
];

export const GOOGLE_BODY_FONTS = [
  { id: 'Inter', label: 'Inter (Default UI Sans)' },
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { id: 'Roboto', label: 'Roboto (Google Standard)' },
  { id: 'Open Sans', label: 'Open Sans' },
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Lato', label: 'Lato' },
  { id: 'Nunito', label: 'Nunito (Rounded Friendly)' },
  { id: 'DM Sans', label: 'DM Sans (Geometric Body)' },
  { id: 'Manrope', label: 'Manrope' },
  { id: 'IBM Plex Sans', label: 'IBM Plex Sans' }
];

export const THEME_PRESETS = [
  {
    id: 'sunset_orange',
    alias: 'premise_orange',
    name: 'Sunset Orange (Cafe)',
    primary: '#ff7a00',
    secondary: '#e06900',
    tertiary: '#ffaa55',
    description: 'Signature warm cafe vibe with vibrant orange & golden accents'
  },
  {
    id: 'cyber_neon',
    alias: 'electric_indigo',
    name: 'Cyber Indigo',
    primary: '#6366f1',
    secondary: '#4f46e5',
    tertiary: '#38bdf8',
    description: 'Futuristic indigo paired with cyan laser highlights'
  },
  {
    id: 'emerald_matrix',
    alias: 'emerald_matrix',
    name: 'Emerald Matrix',
    primary: '#10b981',
    secondary: '#059669',
    tertiary: '#34d399',
    description: 'Fresh organic green & mint tones'
  },
  {
    id: 'obsidian_gold',
    alias: 'amber_ember',
    name: 'Obsidian Gold',
    primary: '#f59e0b',
    secondary: '#d97706',
    tertiary: '#fcd34d',
    description: 'Luxury amber & gold metallic brilliance'
  },
  {
    id: 'velvet_purple',
    alias: 'velvet_rose',
    name: 'Velvet Purple',
    primary: '#a855f7',
    secondary: '#7e22ce',
    tertiary: '#c084fc',
    description: 'Deep royal purple with lavender glows'
  },
  {
    id: 'frost_steel',
    alias: 'sapphire_neon',
    name: 'Frost Steel',
    primary: '#0ea5e9',
    secondary: '#0284c7',
    tertiary: '#38bdf8',
    description: 'Cool ocean ice blue & steel teal'
  },
  {
    id: 'rose_crimson',
    alias: 'burnt_sienna',
    name: 'Rose Crimson',
    primary: '#f43f5e',
    secondary: '#e11d48',
    tertiary: '#fb7185',
    description: 'High energy crimson & coral rose'
  },
  {
    id: 'electric_cyan',
    alias: 'midnight_teal',
    name: 'Electric Cyan',
    primary: '#06b6d4',
    secondary: '#0891b2',
    tertiary: '#67e8f9',
    description: 'Bright electric cyan with deep ocean contrast'
  },
  {
    id: 'warm_amber',
    alias: 'citrus_pop',
    name: 'Warm Amber',
    primary: '#d97706',
    secondary: '#b45309',
    tertiary: '#fbbf24',
    description: 'Cozy rustic amber & warm honey'
  },
  {
    id: 'neon_mint',
    alias: 'terracotta_clay',
    name: 'Neon Mint',
    primary: '#00f5d4',
    secondary: '#00bbf9',
    tertiary: '#7b2cbf',
    description: 'Ultra modern neon mint and cyber blue'
  },
  {
    id: 'sakura_pink',
    alias: 'sakura_pink',
    name: 'Sakura Blossom',
    primary: '#ec4899',
    secondary: '#db2777',
    tertiary: '#f472b6',
    description: 'Elegant cherry blossom pink with soft magenta'
  },
  {
    id: 'nordic_blue',
    alias: 'nordic_blue',
    name: 'Nordic Royal Blue',
    primary: '#2563eb',
    secondary: '#1d4ed8',
    tertiary: '#60a5fa',
    description: 'Deep royal Scandinavian blue & cobalt sky'
  },
  {
    id: 'deep_plum',
    alias: 'deep_plum',
    name: 'Deep Plum Violet',
    primary: '#8b5cf6',
    secondary: '#6d28d9',
    tertiary: '#a78bfa',
    description: 'Rich orchid plum with glowing violet sparks'
  },
  {
    id: 'solar_flare',
    alias: 'solar_flare',
    name: 'Solar Flare Red',
    primary: '#ff4500',
    secondary: '#d63031',
    tertiary: '#ff7675',
    description: 'Intense neon red & fiery solar orange'
  },
  {
    id: 'sage_forest',
    alias: 'sage_forest',
    name: 'Sage Forest',
    primary: '#059669',
    secondary: '#047857',
    tertiary: '#10b981',
    description: 'Deep woodland green with serene sage notes'
  },
  {
    id: 'tokyo_cyberpunk',
    alias: 'tokyo_cyberpunk',
    name: 'Tokyo Cyberpunk',
    primary: '#ff007f',
    secondary: '#7928ca',
    tertiary: '#00dfd8',
    description: 'High contrast hot neon magenta, purple & cyan'
  }
];

export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(255, 122, 0, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(255, 122, 0, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadGoogleFontCss(fontFamily) {
  if (typeof document === 'undefined' || !fontFamily) return;
  const fontId = `google-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(fontId)) return;

  const link = document.createElement('link');
  link.id = fontId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

export function applyGoogleFontHeader(fontFamily) {
  if (typeof document === 'undefined') return;
  const family = fontFamily || 'Plus Jakarta Sans';
  loadGoogleFontCss(family);
  const root = document.documentElement;
  root.style.setProperty('--font-display', `'${family}', var(--font-fallback-sans)`);
  root.style.setProperty('--font-heading', `'${family}', var(--font-fallback-sans)`);
  localStorage.setItem('app_font_header', family);
}

export function applyGoogleFontBody(fontFamily) {
  if (typeof document === 'undefined') return;
  const family = fontFamily || 'Inter';
  loadGoogleFontCss(family);
  const root = document.documentElement;
  root.style.setProperty('--font-body', `'${family}', var(--font-fallback-sans)`);
  root.style.setProperty('--font-sans', `'${family}', var(--font-fallback-sans)`);
  localStorage.setItem('app_font_body', family);
}

export function applyFontAndIconScale(scalePercent) {
  if (typeof document === 'undefined') return;
  const percent = Number(scalePercent) || 100;
  const scale = percent / 100;
  const root = document.documentElement;

  root.style.setProperty('--font-scale', String(scale));
  root.style.setProperty('--icon-scale', String(scale));
  root.style.fontSize = `${percent}%`;
  localStorage.setItem('app_font_scale', String(percent));
}

export function applyAppTheme(presetOrTheme, isDarkMode = true) {
  let primary = '#ff7a00';
  let secondary = '#e06900';
  let tertiary = '#ffaa55';
  let presetId = 'sunset_orange';

  if (typeof presetOrTheme === 'string') {
    const preset = THEME_PRESETS.find((t) => t.id === presetOrTheme || t.alias === presetOrTheme) || THEME_PRESETS[0];
    primary = preset.primary;
    secondary = preset.secondary;
    tertiary = preset.tertiary;
    presetId = preset.id;
  } else if (presetOrTheme && typeof presetOrTheme === 'object') {
    const modeObj = isDarkMode ? presetOrTheme.dark : presetOrTheme.light;
    if (modeObj) {
      primary = modeObj.primary || primary;
      secondary = modeObj.secondary || secondary;
      tertiary = modeObj.accent || modeObj.tertiary || tertiary;
    }
  }

  const root = document.documentElement;
  root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  root.setAttribute('data-color-preset', presetId);

  root.style.setProperty('--accent-primary', primary);
  root.style.setProperty('--accent-secondary', secondary);
  root.style.setProperty('--accent-tertiary', tertiary);
  root.style.setProperty('--accent-wash', hexToRgba(primary, isDarkMode ? 0.14 : 0.08));
  root.style.setProperty('--accent-glow', hexToRgba(primary, isDarkMode ? 0.28 : 0.18));
  root.style.setProperty('--border-focus', hexToRgba(primary, 0.5));
  root.style.setProperty('--shadow-accent', `0 8px 24px ${hexToRgba(primary, isDarkMode ? 0.35 : 0.2)}`);

  localStorage.setItem('app_theme_preset', presetId);
  localStorage.setItem('app_theme', isDarkMode ? 'dark' : 'light');
}

export function initAppTheme() {
  if (typeof window === 'undefined') return;
  const savedPreset = localStorage.getItem('app_theme_preset') || 'sunset_orange';
  const savedMode = localStorage.getItem('app_theme') || 'dark';
  const savedHeaderFont = localStorage.getItem('app_font_header') || 'Plus Jakarta Sans';
  const savedBodyFont = localStorage.getItem('app_font_body') || 'Inter';
  const savedScale = localStorage.getItem('app_font_scale') || '100';

  applyAppTheme(savedPreset, savedMode === 'dark');
  applyGoogleFontHeader(savedHeaderFont);
  applyGoogleFontBody(savedBodyFont);
  applyFontAndIconScale(Number(savedScale));
}
