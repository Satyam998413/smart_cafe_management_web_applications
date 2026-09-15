// Ported unchanged from server/src/config/themePresets.js.
// 4 orange palette presets (plan/multi-tenant-platform-master-plan.md Phase
// 1d) — offered at tenant creation instead of (or alongside) a fully custom
// theme. Each carries both light and dark token sets so organizations.theme
// always has the same { light, dark } shape regardless of whether a preset
// or custom colors were chosen — both the tenant web app and flutter_app's
// org_branding_wrapper.dart read this one shape.
export const THEME_PRESETS = {
  premise_orange: {
    light: { primary: '#FF7A00', secondary: '#E06900', accent: '#FF9A3D', surface: '#FFF8F2', onSurface: '#1C1917' },
    dark: { primary: '#FF7A00', secondary: '#E06900', accent: '#FFAA55', surface: '#141724', onSurface: '#F9FAFB' }
  },
  electric_indigo: {
    light: { primary: '#6366F1', secondary: '#4F46E5', accent: '#818CF8', surface: '#F5F5FE', onSurface: '#1E1B4B' },
    dark: { primary: '#6366F1', secondary: '#4F46E5', accent: '#A5B4FC', surface: '#121426', onSurface: '#F5F5FE' }
  },
  emerald_matrix: {
    light: { primary: '#10B981', secondary: '#059669', accent: '#34D399', surface: '#F0FDF4', onSurface: '#064E3B' },
    dark: { primary: '#10B981', secondary: '#059669', accent: '#6EE7B7', surface: '#0D1F18', onSurface: '#ECFDF5' }
  },
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
  },
  sapphire_neon: {
    light: { primary: '#3B82F6', secondary: '#2563EB', accent: '#60A5FA', surface: '#EFF6FF', onSurface: '#1E3A8A' },
    dark: { primary: '#3B82F6', secondary: '#2563EB', accent: '#93C5FD', surface: '#0F172A', onSurface: '#F0F9FF' }
  },
  velvet_rose: {
    light: { primary: '#EC4899', secondary: '#DB2777', accent: '#F472B6', surface: '#FDF2F8', onSurface: '#831843' },
    dark: { primary: '#EC4899', secondary: '#DB2777', accent: '#FBCFE8', surface: '#28111D', onSurface: '#FDF2F8' }
  },
  midnight_teal: {
    light: { primary: '#14B8A6', secondary: '#0D9488', accent: '#2DD4BF', surface: '#F0FDFA', onSurface: '#134E4A' },
    dark: { primary: '#14B8A6', secondary: '#0D9488', accent: '#5EEAD4', surface: '#0D1E1F', onSurface: '#F0FDFA' }
  }
};

export const resolveThemePreset = (presetKey) => THEME_PRESETS[presetKey] ?? null;
