export const Colors = {
  // Primary palette
  primary:     '#6C63FF',   // indigo
  primaryDark: '#4B44CC',
  accent:      '#FF6584',   // coral

  // Verdicts
  watch:    '#22C55E',      // green
  skip:     '#EF4444',      // red
  optional: '#F59E0B',      // amber

  // Backgrounds
  bg:        '#0F0F14',     // near-black
  bgCard:    '#1A1A24',
  bgInput:   '#252533',

  // Text
  textPrimary:   '#F8F8FF',
  textSecondary: '#9999AA',
  textMuted:     '#555566',

  // Borders
  border:     '#2A2A3A',
  borderFaint:'#1E1E2C',

  // Score tiers (1–5)
  score1: '#EF4444',
  score2: '#F97316',
  score3: '#F59E0B',
  score4: '#22C55E',
  score5: '#10B981',
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const Radius = {
  sm:   8,
  md:  12,
  lg:  20,
  xl:  28,
  full: 9999,
} as const;

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.8 },
} as const;
