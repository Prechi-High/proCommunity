import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

const STROKE = 3;

/** Square-ended L focus corners — framing guide (camera) or animation anchor. */
export function FocusCorners({
  size,
  inset = 0,
  color = colors.white,
  style,
}: {
  size: number;
  inset?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const arm = Math.max(12, size * 0.18);
  const box = size - inset * 2;
  const corner = (top: number, left: number, flipH: boolean, flipV: boolean) => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left,
        width: arm,
        height: arm,
        borderColor: color,
        borderTopWidth: flipV ? 0 : STROKE,
        borderBottomWidth: flipV ? STROKE : 0,
        borderLeftWidth: flipH ? 0 : STROKE,
        borderRightWidth: flipH ? STROKE : 0,
      }}
    />
  );
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View style={{ position: 'absolute', top: inset, left: inset, width: box, height: box }}>
        {corner(0, 0, false, false)}
        {corner(0, box - arm, true, false)}
        {corner(box - arm, 0, false, true)}
        {corner(box - arm, box - arm, true, true)}
      </View>
    </View>
  );
}
