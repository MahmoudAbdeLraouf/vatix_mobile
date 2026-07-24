// Design tokens mirrored from vatix_website/app/globals.css
// Keep in sync — website is source of truth.

export const colors = {
  // Yellow / amber
  y: '#F5B800',
  yl: '#FFF9E6',
  yd: '#D9A200',
  // Dark navy
  dk: '#062B5B',
  dk2: '#10366B',
  dk3: '#1A437E',
  // Greys
  white: '#FFFFFF',
  g50: '#FAFAFA',
  g100: '#F7F8FA',
  g200: '#EAECF0',
  g300: '#D0D5DD',
  g400: '#98A2B3',
  g500: '#667085',
  g600: '#475467',
  g700: '#344054',
  g800: '#2D3748',
  g900: '#101828',
  // Semantic
  green: '#12B886',
  gl: '#EBFBEE',
  red: '#E53E3E',
  rl: '#FFF5F5',
  blue: '#3B82F6',
  bl: '#EFF6FF',
  orange: '#F97316',
  ol: '#FFF7ED',
  // Legacy semantic aliases (existing code may reference these)
  success: '#12B886',
  error: '#E53E3E',
  warning: '#F97316',
}

export const fonts = {
  regular: 'Cairo_400Regular',
  semiBold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extraBold: 'Cairo_800ExtraBold',
  black: 'Cairo_900Black',
  tajawal: 'Tajawal_400Regular',
  tajawalBold: 'Tajawal_700Bold',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

// Website: --rs 8, --r 12, --rl2 20
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
}

// Website shadows use rgba(6,43,91, x) — navy tinted
export const shadow = {
  // --ss: 0 1px 3px rgba(6,43,91,.08)
  ss: {
    shadowColor: '#062B5B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  // --sm: 0 4px 16px rgba(6,43,91,.12)
  sm: {
    shadowColor: '#062B5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  // --sl: 0 8px 32px rgba(6,43,91,.18)
  sl: {
    shadowColor: '#062B5B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 6,
  },
  // Legacy alias
  md: {
    shadowColor: '#062B5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
}
