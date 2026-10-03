import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import { FocusCorners } from '@/components/brand/FocusCorners';
import { FocusU } from '@/components/brand/FocusU';
import { colors } from '@/constants/theme';

/**
 * Anticipation loop — corners expand/contract around a fixed Focus U (spec step 4).
 * `active` false or `reducedMotion` stops the loop immediately.
 */
export function FocusFrame({
  size = 120,
  active = true,
  color = colors.hi,
  uColor = colors.hi,
}: {
  size?: number;
  active?: boolean;
  color?: string;
  uColor?: string;
}) {
  const [reduced, setReduced] = useState(false);
  const expand = useRef(new Animated.Value(0)).current;
  const notch = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (!active || reduced) {
      expand.stopAnimation();
      notch.stopAnimation();
      expand.setValue(0);
      notch.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(expand, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(120),
        Animated.timing(expand, { toValue: 0.15, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(notch, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(250),
        Animated.timing(expand, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(notch, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduced, expand, notch]);

  const scale = reduced
    ? 1
    : expand.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const uSize = size * 0.42;
  const notchOpacity = reduced ? 0 : notch;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <FocusCorners size={size} color={color} />
      </Animated.View>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <FocusU size={uSize} color={uColor} />
        {!reduced ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: uSize * 0.08,
              right: uSize * 0.22,
              width: uSize * 0.12,
              height: uSize * 0.12,
              borderTopWidth: 2.5,
              borderRightWidth: 2.5,
              borderColor: uColor,
              opacity: notchOpacity,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
