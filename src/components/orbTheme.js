// Per-state orb color language — kept in exact lockstep with
// flutter_app/lib/presentation/screens/smart_ai_voice_tab.dart's
// `_getThemeColorForState()` (AppTheme.primary / AppTheme.error /
// Colors.amber) so the web VoiceOrb and the Flutter orb read as the same
// object, not a reinterpretation. `core` is the solid color VoiceOrb.jsx's
// three concentric layers are built from; `gradient`/`glow` are kept for
// MiniOrb.jsx/TypingIndicator.jsx's smaller decorative dots.
export const ORB_THEME = {
  idle: {
    core: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', // AppTheme.primaryGradient
    glow: 'rgba(245, 158, 11, 0.4)',
    ring: 'rgba(245, 158, 11, 0.4)'
  },
  listening: {
    core: '#EF4444', // AppTheme.error
    gradient: 'linear-gradient(135deg, #EF4444, #DC2626)',
    glow: 'rgba(239, 68, 68, 0.4)',
    ring: 'rgba(239, 68, 68, 0.4)'
  },
  thinking: {
    core: '#FFC107', // Colors.amber
    gradient: 'linear-gradient(135deg, #FFC107, #FF8F00)',
    glow: 'rgba(255, 193, 7, 0.4)',
    ring: 'rgba(255, 193, 7, 0.4)'
  },
  speaking: {
    core: '#F59E0B', // AppTheme.primary — same as idle, matches Flutter
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    glow: 'rgba(245, 158, 11, 0.4)',
    ring: 'rgba(245, 158, 11, 0.4)'
  }
};
