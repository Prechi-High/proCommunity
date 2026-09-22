import { Appearance, Platform, type ViewStyle } from 'react-native';

const isDark = Appearance.getColorScheme() === 'dark';

export const colors = (isDark
  ? {
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
    }
  : {
      wine: '#F8F5F0',
      wineDeep: '#F2EAE2',
      lac: '#FFFFFF',
      lac2: '#F6EEE8',
      redact: '#25151A',
      bone: '#25151A',
      bone2: '#665A58',
      bone3: '#958A86',
      line: '#E7DED7',
      sage: '#2D7D59',
      honey: '#B67914',
      coral: '#B94D45',
      hi: '#D9A92E',
      stage: '#EFE8E0',
      shell: '#F8F5F0',
      ink: '#25151A',
      inkSoft: '#665A58',
      rosewood: '#A14A60',
      rosewoodSoft: '#F7E8ED',
      honeySoft: '#F9F0D5',
      honeyInk: '#8E5F0B',
      honeyBadge: '#B67914',
      sageSoft: '#E6F4EC',
      sageInk: '#2D7D59',
      mist: '#F1EAE4',
      white: '#FFFFFF',
      webShell: '#EFE8E0',
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
    raised: { boxShadow: '0 8px 24px rgba(37,21,26,0.10)' },
    lifted: { boxShadow: '0 30px 80px rgba(37,21,26,0.16)' },
  },
  default: {
    flat: { shadowOpacity: 0, elevation: 0 },
    raised: {
      shadowColor: '#25151A',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    lifted: {
      shadowColor: '#25151A',
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 8,
    },
  },
}) as Record<'flat' | 'raised' | 'lifted', ViewStyle>;

export const scrim = {
  soft: 'rgba(37,21,26,0.20)',
  strong: 'rgba(37,21,26,0.60)',
  onLight: 'rgba(255,255,255,0.78)',
} as const;

export const scrimGradient = {
  soft: ['rgba(248,245,240,0)', 'rgba(248,245,240,0.55)', 'rgba(248,245,240,0.96)'] as const,
  strong: ['rgba(37,21,26,0)', 'rgba(37,21,26,0.35)', 'rgba(37,21,26,0.82)'] as const,
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
