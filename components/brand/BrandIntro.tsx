import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Modal, Pressable, Text, View } from 'react-native';

import { FocusCorners } from '@/components/brand/FocusCorners';
import { brandAssets } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';

const DURATION_MS = 2000;
const TAGLINE_ASPECT = 2.85;

export function BrandIntro({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [reduced, setReduced] = useState(false);
  const corners = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      logo.setValue(1);
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
    corners.setValue(0);
    logo.setValue(0);
    Animated.sequence([
      Animated.timing(corners, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(logo, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(Math.max(0, DURATION_MS - 1350)),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
    return undefined;
  }, [visible, reduced, corners, logo, onDone]);

  const cornerScale = corners.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] });
  const logoH = 72;
  const logoW = logoH * TAGLINE_ASPECT;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onDone}>
      <View style={{ flex: 1, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          style={{ position: 'absolute', top: 20, right: 20, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Skip</Text>
        </Pressable>

        <Animated.View style={{ transform: [{ scale: reduced ? 1 : cornerScale }], marginBottom: 28 }}>
          <FocusCorners size={160} color={colors.hi} />
        </Animated.View>

        <Animated.View style={{ opacity: reduced ? 1 : logo, alignItems: 'center' }}>
          <Image
            source={brandAssets.fullTaglineInk}
            style={{ width: logoW, height: logoH, resizeMode: 'contain' }}
            accessibilityLabel="Unmask — Know before you buy"
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
