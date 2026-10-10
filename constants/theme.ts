import { Platform, type ViewStyle } from 'react-native';

import { BRAND_COPY } from './brand';

/**
 * Go-ahead mockup tokens — cream, ink, burgundy primary, gold accents.
 * Legacy names (`wine`, `lac`, `bone`, `hi`) keep existing screens swappable.
 */
export const colors = {
  wine: '#FDFBF7',
  wineDeep: '#F5F0E8',
  lac: '#FFFFFF',
  lac2: '#F5F2ED',
  redact: '#161616',
  bone: '#161616',
  bone2: '#595959',
  bone3: '#8A8780',
  line: '#E8E4DC',
  sage: '#236044',
  honey: '#7A4B00',
  coral: '#A52323',
  brand: '#5C1620',
  brandDeep: '#3D0F15',
  gold: '#C9A227',
  goldSoft: '#F5E9C8',
  headerBg: '#5C1620',
  hi: '#5C1620',
  hiSoft: '#F3E8EA',
  hiInk: '#3D0F15',
  stage: '#E8E5DF',
  shell: '#FDFBF7',
  ink: '#161616',
  inkSoft: '#595959',
  rosewood: '#5C1620',
  rosewoodSoft: '#F3E8EA',
  honeySoft: '#FFF6E8',
  honeyInk: '#7A4B00',
  honeyBadge: '#7A4B00',
  sageSoft: '#E8F3ED',
  sageInk: '#236044',
  coralSoft: '#FBEAEA',
  mist: '#EDEAE4',
  white: '#FFFFFF',
  black: '#161616',
  webShell: '#E8E5DF',
  mark: '#F5E9C8',
  markInk: '#161616',
  markDark: '#5C1620',
  markGood: '#D8EDE3',
  markGoodInk: '#236044',
  markBad: '#F5DEDE',
  markBadInk: '#A52323',
  marker: '#F2D25B',
  markerInk: '#161616',
  markerConcern: '#C45C4A',
} as const;

export const radii = {
  card: 14,
  button: 10,
  photo: 12,
  chip: 999,
  notice: 0,
  thumb: 12,
  search: 14,
  ib: 12,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  sec: 48,
} as const;

export const type = {
  wordmark: 22,
  hero: 40,
  hLg: 28,
  hMd: 17,
  hSm: 14,
  body: 16,
  caption: 14,
  eyebrow: 12,
  button: 16,
  chip: 14,
  badge: 12,
  score: 64,
} as const;

export const elevation = Platform.select({
  web: {
    flat: {},
    raised: { boxShadow: '0 1px 2px rgba(22,22,22,0.04), 0 6px 20px rgba(22,22,22,0.06)' },
    lifted: { boxShadow: '0 20px 60px rgba(22,22,22,0.12)' },
  },
  default: {
    flat: { shadowOpacity: 0, elevation: 0 },
    raised: {
      shadowColor: '#161616',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    lifted: {
      shadowColor: '#161616',
      shadowOpacity: 0.14,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 8,
    },
  },
}) as Record<'flat' | 'raised' | 'lifted', ViewStyle>;

export const scrim = {
  soft: 'rgba(22,22,22,0.18)',
  strong: 'rgba(22,22,22,0.62)',
  onLight: 'rgba(255,255,255,0.72)',
} as const;

export const scrimGradient = {
  soft: ['rgba(253,251,247,0)', 'rgba(253,251,247,0.5)', 'rgba(253,251,247,0.96)'] as const,
  strong: ['rgba(22,22,22,0)', 'rgba(22,22,22,0.28)', 'rgba(22,22,22,0.8)'] as const,
} as const;

export const fonts = {
  regular: 'GeneralSans-Regular',
  medium: 'GeneralSans-Medium',
  semibold: 'GeneralSans-Semibold',
  bold: 'GeneralSans-Bold',
  serif: 'Boska-Medium',
  serifBold: 'Boska-Bold',
} as const;

export const DISCLAIMER = BRAND_COPY.disclaimer;
