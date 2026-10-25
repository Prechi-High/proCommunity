import { View } from 'react-native';

import { colors } from '@/constants/theme';

function Corner({ rotate, color }: { rotate: string; color: string }) {
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderColor: color,
        borderTopWidth: 1.5,
        borderLeftWidth: 1.5,
        transform: [{ rotate }],
      }}
    />
  );
}

export function FocusCorners({ selected, ink }: { selected?: boolean; ink?: boolean }) {
  if (!selected) return null;
  const color = ink ? colors.brandDeep : 'rgba(255,255,255,0.92)';
  return (
    <View
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
        justifyContent: 'space-between',
        pointerEvents: 'none',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Corner rotate="0deg" color={color} />
        <Corner rotate="90deg" color={color} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Corner rotate="270deg" color={color} />
        <Corner rotate="180deg" color={color} />
      </View>
    </View>
  );
}
