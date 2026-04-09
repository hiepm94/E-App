const COLORS = {
  background: '#FFFFFF',      // Clean white background
  surface: 'rgba(255, 255, 255, 0.85)', // Substantial glassy white
  surfaceSolid: '#F8F9FA',    // Very light grey for contrast surfaces
  surfaceLight: 'rgba(255, 140, 0, 0.05)', // Extremely faint orange tint
  primary: '#FF6B00',         // Vibrant, premium orange
  primaryVariant: '#E65100',  // Deep, authoritative burnt orange
  secondary: '#FFB74D',       // Soft, amber-orange accent
  error: '#D32F2F',           // Professional red
  onBackground: '#212121',    // Near-black for sharp reading
  onSurface: '#37474F',       // Charcoal for secondary text
  onPrimary: '#FFFFFF',       // White text on orange
  onSecondary: '#212121',
  textMuted: '#757575',       // Medium grey for meta info
  border: 'rgba(255, 107, 0, 0.15)',  // Subtle orange-tinted border
};

const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: '800', color: COLORS.onBackground, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700', color: COLORS.onBackground, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600', color: COLORS.onBackground },
  body1: { fontSize: 16, color: COLORS.onSurface, lineHeight: 24 },
  body2: { fontSize: 14, color: COLORS.textMuted, lineHeight: 20 },
  caption: { fontSize: 12, color: COLORS.textMuted },
  button: { fontSize: 15, fontWeight: '700', color: COLORS.onPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
};

const SHADOWS = {
  small: { shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  medium: { shadowColor: '#E65100', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 5 },
  antigravity: { shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 32, elevation: 8 },
};

export const THEME = {
  colors: COLORS,
  typography: TYPOGRAPHY,
  shadows: SHADOWS,
  borderRadius: { small: 8, medium: 16, large: 24, pill: 999 },
};

