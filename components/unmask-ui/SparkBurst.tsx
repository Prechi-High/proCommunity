import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Lightning, Sparkle } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';

export function SparkBurst({ show, thunder }: { show: boolean; thunder?: boolean }) {
  const scale = useSharedValue(0.86);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(show ? 1 : 0, { duration: 200 });
    scale.value = show ? withSpring(1, { damping: 14, stiffness: 180 }) : withTiming(0.86, { duration: 160 });
  }, [opacity, scale, show]);
  const motion = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  if (!show) return null;
  return (
    <Animated.View style={[{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 8 }, motion]}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: thunder ? colors.goldSoft : colors.hiSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {thunder ? (
          <Lightning size={28} color={colors.honeyInk} weight="fill" />
        ) : (
          <Sparkle size={28} color={colors.brandDeep} weight="fill" />
        )}
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>It landed. This is moving.</Text>
    </Animated.View>
  );
}
