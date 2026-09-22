import { Appearance, Platform, type ViewStyle } from 'react-native';

const isDark = Appearance.getColorScheme() === 'dark';

export const colors = (isDark ? {
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
  shell: '#2A0E16',
  ink: '#F3EBE2',
  inkSoft: 'rgba(243,235,226,0.70)',
  rosewood: '#F2D25B',
  rosewoodSoft: '#4B2030',
  honeySoft: 'rgba(232,185,90,0.16)',
  honeyInk: '#E8B95A',
  honeyBadge: '#E8B95A',
  sageSoft: 'rgba(159,208,171,0.16)',
  sageInk: '#9FD0AB',
  mist: 'rgba(243,235,226,0.14)',
  white: '#3A1622',
  webShell: '#12060A',
} : {
  wine: '#F7F2ED',
  wineDeep: '#F0E7E1',
  lac: '#FFFFFF',
  lac2: '#F5EEE8',
  redact: '#1D1015',
  bone: '#1E1217',
  bone2: '#674F53',
  bone3: '#9A8488',
  line: '#E8DED8',
  sage: '#2E7D5A',
  honey: '#B87A17',
  coral: '#BC524B',
  hi: '#D7A934',
  stage: '#F1E9E4',
  shell: '#F7F2ED',
  ink: '#1E1217',
  inkSoft: '#674F53',
  rosewood: '#A2495E',
  rosewoodSoft: '#F8EAEF',
  honeySoft: '#F9F0D8',
  honeyInk: '#8E5C0D',
  honeyBadge: '#B87A17',
  sageSoft: '#EAF6EE',
  sageInk: '#2E7D5A',
  mist: '#F4ECE8',
  white: '#FFFFFF',
  webShell: '#F1E9E4',
}) as const;

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
    raised: { boxShadow: '0 8px 24px rgba(30,18,23,0.08)' },
    lifted: { boxShadow: '0 30px 80px rgba(30,18,23,0.12)' },
  },
  default: {
    flat: { shadowOpacity: 0, elevation: 0 },
    raised: {
      shadowColor: '#1E1217',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    lifted: {
      shadowColor: '#1E1217',
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 8,
    },
  },
}) as Record<'flat' | 'raised' | 'lifted', ViewStyle>;

export const scrim = {
  soft: 'rgba(30,18,23,0.18)',
  strong: 'rgba(30,18,23,0.62)',
  onLight: 'rgba(255,255,255,0.72)',
} as const;

export const scrimGradient = {
  soft: ['rgba(247,242,237,0)', 'rgba(247,242,237,0.5)', 'rgba(247,242,237,0.96)'] as const,
  strong: ['rgba(30,18,23,0)', 'rgba(30,18,23,0.28)', 'rgba(30,18,23,0.8)'] as const,
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
