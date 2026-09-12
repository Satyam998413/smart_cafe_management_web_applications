// Ported unchanged from server/src/config/themePresets.js.
// 4 orange palette presets (plan/multi-tenant-platform-master-plan.md Phase
// 1d) — offered at tenant creation instead of (or alongside) a fully custom
// theme. Each carries both light and dark token sets so organizations.theme
// always has the same { light, dark } shape regardless of whether a preset
// or custom colors were chosen — both the tenant web app and flutter_app's
// org_branding_wrapper.dart read this one shape.
export const THEME_PRESETS = {
  amber_ember: {
    light: { primary: '#FF8A00', secondary: '#FFB74D', accent: '#D84315', surface: '#FFF3E0', onSurface: '#2A1B0A' },
    dark: { primary: '#FF8A00', secondary: '#FFB74D', accent: '#FF8A65', surface: '#241A10', onSurface: '#FFE8D1' }
  },
  burnt_sienna: {
    light: { primary: '#E86A33', secondary: '#F4A261', accent: '#9C3B1D', surface: '#FFF1E6', onSurface: '#2B1710' },
    dark: { primary: '#E86A33', secondary: '#F4A261', accent: '#F4A261', surface: '#221510', onSurface: '#FBE4D6' }
  },
  citrus_pop: {
    light: { primary: '#FF7A00', secondary: '#FFC145', accent: '#C1440E', surface: '#FFF8E7', onSurface: '#2A1D08' },
    dark: { primary: '#FF7A00', secondary: '#FFC145', accent: '#FF9A3D', surface: '#231A0D', onSurface: '#FFEFCF' }
  },
  terracotta_clay: {
    light: { primary: '#CB6843', secondary: '#E2A672', accent: '#8C3B1B', surface: '#FBEDE3', onSurface: '#2A190F' },
    dark: { primary: '#CB6843', secondary: '#E2A672', accent: '#E2A672', surface: '#20150F', onSurface: '#F5E2D3' }
  }
};

export const resolveThemePreset = (presetKey) => THEME_PRESETS[presetKey] ?? null;
