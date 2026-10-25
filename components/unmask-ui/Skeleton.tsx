import { View } from 'react-native';

import { colors, radii } from '@/constants/theme';

export function Skeleton({ height = 16, width = '100%' as const, radius = 8 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  return <View style={{ height, width, borderRadius: radius, backgroundColor: colors.mist }} />;
}

export function StorySkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}>
      <View style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radii.photo, backgroundColor: colors.mist }} />
      <Skeleton height={22} width="88%" />
      <Skeleton height={14} width="42%" />
    </View>
  );
}
