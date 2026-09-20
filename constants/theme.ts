import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  shell: '#FBF5F1',
  ink: '#2A211D',
  inkSoft: '#6B5F57',
  rosewood: '#8C3547',
  rosewoodSoft: '#F4E8EA',
  honey: '#D9A441',
  honeySoft: '#FBF1DC',
  honeyInk: '#6B4D0F',
  sage: '#6E8F73',
  sageSoft: '#E8F0E9',
  sageInk: '#3F5C44',
  honeyBadge: '#8A6414',
  mist: '#E7DED7',
  white: '#FFFFFF',
  webShell: '#E8E2DC',
} as const;

export const radii = {
  card: 14,
  button: 12,
  photo: 18,
  chip: 999,
  notice: 8,
  thumb: 10,
} as const;

/** Match HTML screen-body rhythm (14px gaps). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 24,
} as const;

/** Type scale aligned to ui-screens-v1 HTML. */
export const type = {
  wordmark: 21,
  hLg: 24,
  hMd: 16,
  hSm: 13,
  body: 13,
  caption: 11,
  eyebrow: 10,
  button: 14,
  chip: 12,
  badge: 10,
} as const;

/**
 * Three levels only. Elevation carries hierarchy: the thing we want read first
 * on a screen sits higher than everything below it. Web takes boxShadow; the
 * shadow* props are deprecated there and silently drop out.
 */
export const elevation = Platform.select({
  web: {
    flat: {},
    raised: { boxShadow: '0 4px 10px rgba(42,33,29,0.06)' },
    lifted: { boxShadow: '0 10px 20px rgba(42,33,29,0.12)' },
  },
  default: {
    flat: {
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    raised: {
      shadowColor: '#2A211D',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    lifted: {
      shadowColor: '#2A211D',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
}) as Record<'flat' | 'raised' | 'lifted', ViewStyle>;

/**
 * Scrims laid over photography so text stays readable without dulling the
 * image. Gradients rather than flat blocks — a hard grey band reads as a bar
 * sitting on the photo instead of part of it.
 */
export const scrim = {
  soft: 'rgba(42,33,29,0.28)',
  strong: 'rgba(42,33,29,0.55)',
  onLight: 'rgba(255,255,255,0.78)',
} as const;

export const scrimGradient = {
  soft: ['rgba(42,33,29,0)', 'rgba(42,33,29,0.16)', 'rgba(42,33,29,0.58)'] as const,
  strong: ['rgba(42,33,29,0)', 'rgba(42,33,29,0.34)', 'rgba(42,33,29,0.82)'] as const,
} as const;

export const fonts = {
  regular: 'GeneralSans-Regular',
  medium: 'GeneralSans-Medium',
  semibold: 'GeneralSans-Semibold',
  bold: 'GeneralSans-Bold',
} as const;

export const DISCLAIMER =
  'This platform shares community insight and general information, not medical or dermatological advice. Always patch-test new products and consult a professional for skin concerns.';
