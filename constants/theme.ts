import { Platform, type ViewStyle } from 'react-native';

/**
 * Sourced design system — royal blue + black, Apple-grade restraint.
 * Token names are historical: `wine` = page background, `lac` = card, `bone` = primary ink,
 * `hi` = the single accent. Keep new screens on these tokens so the palette stays swappable.
 */
export const colors = {
  wine: '#F5F5F7',
  wineDeep: '#EBEBF0',
  lac: '#FFFFFF',
  lac2: '#F2F2F5',
  redact: '#000000',
  bone: '#0A0A0B',
  bone2: '#56565C',
  bone3: '#8E8E93',
  line: '#E3E3E8',
  sage: '#1F9D55',
  honey: '#C27C0E',
  coral: '#D93A3A',
  hi: '#1A4DFF',
  hiSoft: '#E8EEFF',
  hiInk: '#0F2FA8',
  stage: '#E9E9EE',
  shell: '#F5F5F7',
  ink: '#0A0A0B',
  inkSoft: '#56565C',
  rosewood: '#1A4DFF',
  rosewoodSoft: '#E8EEFF',
  honeySoft: '#FFF4E0',
  honeyInk: '#8A5500',
  honeyBadge: '#C27C0E',
  sageSoft: '#E6F6EC',
  sageInk: '#137A3F',
  coralSoft: '#FDEBEB',
  mist: '#EFEFF3',
  white: '#FFFFFF',
  black: '#000000',
  webShell: '#E9E9EE',
  /** Highlighter: the "we just exposed it" reveal behind key phrases. */
  mark: '#CFDCFF',
  markInk: '#0A0A0B',
  markDark: '#1A4DFF',
} as const;

export const radii = {
  card: 20,
  button: 14,
  photo: 16,
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
  xl: 20,
  xxl: 24,
  sec: 36,
} as const;

export const type = {
  wordmark: 22,
  hero: 40,
  hLg: 28,
  hMd: 17,
  hSm: 14,
  body: 15,
  caption: 13,
  eyebrow: 12,
  button: 16,
  chip: 14,
  badge: 12,
  score: 64,
} as const;

export const elevation = Platform.select({
  web: {
    flat: {},
    raised: { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.06)' },
    lifted: { boxShadow: '0 20px 60px rgba(0,0,0,0.12)' },
  },
  default: {
    flat: { shadowOpacity: 0, elevation: 0 },
    raised: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    lifted: {
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 8,
    },
  },
}) as Record<'flat' | 'raised' | 'lifted', ViewStyle>;

export const scrim = {
  soft: 'rgba(0,0,0,0.18)',
  strong: 'rgba(0,0,0,0.62)',
  onLight: 'rgba(255,255,255,0.72)',
} as const;

export const scrimGradient = {
  soft: ['rgba(245,245,247,0)', 'rgba(245,245,247,0.5)', 'rgba(245,245,247,0.96)'] as const,
  strong: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.8)'] as const,
} as const;

export const fonts = {
  regular: 'GeneralSans-Regular',
  medium: 'GeneralSans-Medium',
  semibold: 'GeneralSans-Semibold',
  bold: 'GeneralSans-Bold',
  serif: 'GeneralSans-Semibold',
  serifBold: 'GeneralSans-Bold',
} as const;

export const DISCLAIMER =
  'Sourced organises public evidence from across the web. Always check the seller and product details before you buy.';
