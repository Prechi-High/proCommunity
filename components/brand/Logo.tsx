import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { BrandTagline, Wordmark } from '@/components/brand/Wordmark';

type LogoVariant = 'combination' | 'wordmark' | 'symbol' | 'fullTagline';
type LogoTone = 'ink' | 'white';

/** Serif wordmark from go-ahead mockups (replaces legacy raster Focus-U kit). */
export function Logo({
  variant = 'fullTagline',
  tone = 'ink',
  height = 28,
  showTagline = false,
  style,
}: {
  variant?: LogoVariant;
  tone?: LogoTone;
  height?: number;
  showTagline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const withTagline = variant === 'fullTagline' || showTagline;
  return (
    <View style={[{ gap: 4, alignItems: 'flex-start' }, style]} accessibilityRole="image" accessibilityLabel="Unmask">
      <Wordmark height={height} tone={tone} showStar={variant !== 'wordmark'} />
      {withTagline ? <BrandTagline tone={tone} /> : null}
    </View>
  );
}

export { BrandTagline } from '@/components/brand/Wordmark';
