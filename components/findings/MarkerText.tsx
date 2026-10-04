import { Text, View, type StyleProp, type TextStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';

export function MarkerText({
  text,
  highlight,
  variant = 'default',
  style,
}: {
  text: string;
  highlight?: string;
  variant?: 'default' | 'underline' | 'concern';
  style?: StyleProp<TextStyle>;
}) {
  if (!highlight || !text.includes(highlight)) {
    return <Text style={[{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.bone }, style]}>{text}</Text>;
  }
  const [before, after] = text.split(highlight);
  if (variant === 'underline') {
    return (
      <Text style={[{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.bone }, style]}>
        {before}
        <Text style={{ textDecorationLine: 'underline', textDecorationColor: colors.hi, color: colors.bone }}>{highlight}</Text>
        {after}
      </Text>
    );
  }
  if (variant === 'concern') {
    return (
      <Text style={[{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.bone }, style]}>
        {before}
        <Text style={{ textDecorationLine: 'underline', textDecorationColor: colors.markerConcern, color: colors.bone }}>{highlight}</Text>
        {after}
      </Text>
    );
  }
  return (
    <Text style={[{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.bone }, style]}>
      {before}
      <Text style={{ fontFamily: fonts.medium, color: colors.markerInk, backgroundColor: colors.marker }}>{highlight}</Text>
      {after}
    </Text>
  );
}
