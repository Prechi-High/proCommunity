import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { MagnifyingGlass } from '@/components/icons';
import { colors } from '@/constants/theme';

export function UnmaskingLoader({ size = 120 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const ring = size * 0.92;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: 3,
          borderColor: 'rgba(201,162,39,0.35)',
          borderTopColor: colors.gold,
          transform: [{ rotate }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: ring * 0.72,
          height: ring * 0.72,
          borderRadius: (ring * 0.72) / 2,
          borderWidth: 2,
          borderColor: 'rgba(92,22,32,0.2)',
          borderRightColor: colors.hi,
          transform: [{ rotate }, { scale }],
        }}
      />
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size * 0.21,
          backgroundColor: 'rgba(61,15,21,0.85)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MagnifyingGlass size={size * 0.22} color={colors.gold} weight="bold" />
      </View>
    </View>
  );
}
