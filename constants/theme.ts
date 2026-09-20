import { Platform, type ViewStyle } from 'react-native';

/**
 * Sourced V1 visual system — exact tokens from
 * `project info/sourced-v1 (1).html`.
 *
 * Dark wine canvas, bone type, Boska display + General Sans UI.
 * Highlight yellow (`hi`) marks focus / active chrome; CTAs are bone-on-wine.
 */
export const colors = {
  wine: '#2A0E16',
  wineDeep: '#210A11',
  lac: '#3A1622',
  lac2: '#4B2030',
  redact: '#0B0306',
  bone: '#F3EBE2',
  bone2: 'rgba(243,235,226,0.70)',
  bone3: 'rgba(243,235,226,0.45)',
  line: 'rgba(243,235,226,0.14)',
  sage: '#9FD0AB',
  honey: '#E8B95A',
  coral: '#EE8C7C',
  hi: '#F2D25B',
  stage: '#12060A',

  /** Legacy aliases — map old Shell/Rosewood call sites onto V1. */
  shell: '#2A0E16',
  ink: '#F3EBE2',
  inkSoft: 'rgba(243,235,226,0.70)',
  rosewood: '#F2D25B',
  rosewoodSoft: '#4B2030',
  honeySoft: 'rgba(232,185,90,0.16)',
  honeyInk: '#E8B95A',
  sageSoft: 'rgba(159,208,171,0.16)',
  sageInk: '#9FD0AB',
  honeyBadge: '#E8B95A',
  mist: 'rgba(243,235,226,0.14)',
  white: '#3A1622',
  webShell: '#12060A',
} as const;

export const radii = {
  card: 22,
  button: 16,
  photo: 14,
  chip: 999,
  notice: 0,
  thumb: 12,
  search: 28,
  ib: 14,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  sec: 44,
} as const;

export const type = {
  wordmark: 25,
  hero: 54,
  hLg: 27,
  hMd: 17,
  hSm: 14,
  body: 14,
  caption: 12.5,
  eyebrow: 12,
  button: 16,
  chip: 14,
  badge: 12,
  score: 132,
} as const;

export const elevation = Platform.select({
  web: {
    flat: {},
    raised: { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
    lifted: { boxShadow: '0 30px 80px rgba(0,0,0,0.6)' },
  },
  default: {
    flat: { shadowOpacity: 0, elevation: 0 },
    raised: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    lifted: {
      shadowColor: '#000',
      shadowOpacity: 0.55,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 10,
    },
  },
}) as Record<'flat' | 'raised' | 'lifted', ViewStyle>;

export const scrim = {
  soft: 'rgba(11,3,6,0.35)',
  strong: 'rgba(11,3,6,0.7)',
  onLight: 'rgba(243,235,226,0.78)',
} as const;

export const scrimGradient = {
  soft: ['rgba(42,14,22,0)', 'rgba(42,14,22,0.4)', 'rgba(42,14,22,0.92)'] as const,
  strong: ['rgba(11,3,6,0)', 'rgba(11,3,6,0.45)', 'rgba(11,3,6,0.9)'] as const,
} as const;

export const fonts = {
  regular: 'GeneralSans-Regular',
  medium: 'GeneralSans-Medium',
  semibold: 'GeneralSans-Semibold',
  bold: 'GeneralSans-Bold',
  serif: 'Boska-Medium',
  serifBold: 'Boska-Bold',
} as const;

export const DISCLAIMER =
  'Community insight and general information. Not medical or dermatological advice. Always patch-test new products and consult a professional for skin concerns.';
