import { Appearance, Platform, type ViewStyle } from 'react-native';

/** Sourced's calm editorial palette. It follows the device appearance at launch. */
const dark = Appearance.getColorScheme() === 'dark';

export const colors = (dark
  ? {
      wine: '#2A0E16', wineDeep: '#210A11', lac: '#3A1622', lac2: '#4B2030', redact: '#0B0306',
      bone: '#F3EBE2', bone2: 'rgba(243,235,226,0.70)', bone3: 'rgba(243,235,226,0.45)',
      line: 'rgba(243,235,226,0.14)', sage: '#9FD0AB', honey: '#E8B95A', coral: '#EE8C7C', hi: '#F2D25B', stage: '#12060A',
      shell: '#2A0E16', ink: '#F3EBE2', inkSoft: 'rgba(243,235,226,0.70)', rosewood: '#F2D25B', rosewoodSoft: '#4B2030', honeySoft: 'rgba(232,185,90,0.16)', honeyInk: '#E8B95A', honeyBadge: '#E8B95A', sageSoft: 'rgba(159,208,171,0.16)', sageInk: '#9FD0AB', mist: 'rgba(243,235,226,0.14)', white: '#3A1622', webShell: '#12060A',
    }
  : {
      wine: '#F8F5F0', wineDeep: '#F0EAE3', lac: '#FFFFFF', lac2: '#F1E8DF', redact: '#25151A',
      bone: '#25151A', bone2: '#665A58', bone3: '#958A86', line: '#E7DED7', sage: '#327B58', honey: '#B47716', coral: '#B94D45', hi: '#D9A92E', stage: '#EAE3DC',
      shell: '#F8F5F0', ink: '#25151A', inkSoft: '#665A58', rosewood: '#9B4352', rosewoodSoft: '#F5E8E5', honeySoft: '#F8EED6', honeyInk: '#8A5D10', honeyBadge: '#B47716', sageSoft: '#E0F1E7', sageInk: '#327B58', mist: '#EEE7E1', white: '#FFFFFF', webShell: '#EAE3DC',
    }) as const;

export const radii = { card: 22, button: 16, photo: 14, chip: 999, notice: 0, thumb: 12, search: 28, ib: 14 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, sec: 44 } as const;
export const type = { wordmark: 25, hero: 54, hLg: 27, hMd: 17, hSm: 14, body: 14, caption: 12.5, eyebrow: 12, button: 16, chip: 14, badge: 12, score: 132 } as const;
export const elevation = Platform.select({ web: { flat: {}, raised: { boxShadow: '0 8px 24px rgba(37,21,26,0.10)' }, lifted: { boxShadow: '0 30px 80px rgba(37,21,26,0.16)' } }, default: { flat: { shadowOpacity: 0, elevation: 0 }, raised: { shadowColor: '#25151A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 }, lifted: { shadowColor: '#25151A', shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 8 } } }) as Record<'flat' | 'raised' | 'lifted', ViewStyle>;
export const scrim = { soft: 'rgba(37,21,26,0.20)', strong: 'rgba(37,21,26,0.60)', onLight: 'rgba(255,255,255,0.78)' } as const;
export const scrimGradient = { soft: ['rgba(248,245,240,0)', 'rgba(248,245,240,0.55)', 'rgba(248,245,240,0.96)'] as const, strong: ['rgba(37,21,26,0)', 'rgba(37,21,26,0.35)', 'rgba(37,21,26,0.82)'] as const };
export const fonts = { regular: 'GeneralSans-Regular', medium: 'GeneralSans-Medium', semibold: 'GeneralSans-Semibold', bold: 'GeneralSans-Bold', serif: 'Boska-Medium', serifBold: 'Boska-Bold' } as const;
export const DISCLAIMER = 'Community insight and general information. Not medical or dermatological advice. Always patch-test new products and consult a professional for skin concerns.';
