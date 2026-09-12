import { THEME_PRESETS } from './themePresets.js';

// Display labels for THEME_PRESETS (plan Phase 1d table) — kept separate
// from themePresets.js itself since that file is a direct, unchanged port
// of the server-side preset data (server/src/config/themePresets.js) and
// has no notion of UI display strings.
const LABELS = {
  amber_ember: 'Amber Ember',
  burnt_sienna: 'Burnt Sienna',
  citrus_pop: 'Citrus Pop',
  terracotta_clay: 'Terracotta Clay'
};

export const THEME_PRESET_OPTIONS = Object.entries(THEME_PRESETS).map(([key, tokens]) => ({
  key,
  label: LABELS[key] || key,
  light: tokens.light,
  dark: tokens.dark
}));
