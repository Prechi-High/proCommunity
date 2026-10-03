import { Image, Text, type ImageStyle, type StyleProp, View, type ViewStyle } from 'react-native';

import { BRAND_TAGLINE, brandAssets } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';

type LogoVariant = 'combination' | 'wordmark' | 'symbol' | 'fullTagline';
type LogoTone = 'ink' | 'white';

const COMBO_ASPECT = 3.35;
const WORDMARK_ASPECT = 3.8;
const FULL_TAGLINE_ASPECT = 2.85;

function source(variant: LogoVariant, tone: LogoTone) {
  if (variant === 'fullTagline') return tone === 'white' ? brandAssets.fullTaglineWhite : brandAssets.fullTaglineInk;
  if (variant === 'symbol') return tone === 'white' ? brandAssets.symbolWhite : brandAssets.symbolInk;
  if (variant === 'wordmark') return brandAssets.wordmarkInk;
  return tone === 'white' ? brandAssets.combinationWhite : brandAssets.combinationInk;
}

function aspect(variant: LogoVariant) {
  if (variant === 'symbol') return 1;
  if (variant === 'wordmark') return WORDMARK_ASPECT;
  if (variant === 'fullTagline') return FULL_TAGLINE_ASPECT;
  return COMBO_ASPECT;
}

/** Raster wordmark/combination from the approved brand kit — never substitute typed text. */
export function Logo({
  variant = 'fullTagline',
  tone = 'ink',
  height = 28,
  showTagline = false,
  style,
  imageStyle,
}: {
  variant?: LogoVariant;
  tone?: LogoTone;
  height?: number;
  showTagline?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}) {
  const w = height * aspect(variant);
  return (
    <View style={[{ gap: 4, alignItems: 'flex-start' }, style]} accessibilityRole="image" accessibilityLabel="Unmask">
      <Image
        source={source(variant, tone)}
        style={[{ width: w, height, resizeMode: 'contain' }, imageStyle]}
        accessibilityIgnoresInvertColors
      />
      {showTagline ? <BrandTagline /> : null}
    </View>
  );
}

export function BrandTagline({ color = colors.bone2, size = 14 }: { color?: string; size?: number }) {
  return (
    <Text style={{ fontFamily: fonts.medium, fontSize: size, color, letterSpacing: -0.2 }} accessibilityRole="text">
      {BRAND_TAGLINE}
    </Text>
  );
}
