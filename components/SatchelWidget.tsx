import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter, useSegments, type Href } from 'expo-router';

import { colors, elevation, fonts } from '@/constants/theme';
import { Cat, Handbag, X } from '@/components/icons';
import { useAppStore } from '@/lib/store';

// Satchel FAB — bone/wine V1 accents (rosewood alias = hi yellow).

export function SatchelLayer() {
  const hydrated = useAppStore((state) => state.hydrated);
  const profile = useAppStore((state) => state.profile);
  const segments = useSegments();
  if (!hydrated || !profile) return null;
  const group = segments[0];
  if (group === '(auth)' || group === '(onboarding)') return null;
  return (
    <>
      <SatchelNudge />
      <SatchelWidget />
    </>
  );
}

/**
 * 09b — a reminder, never a deadline.
 *
 * Shows at most once a day, says nothing about expiry or urgency, and is
 * dismissible in one tap. Suppressed entirely inside the in-app store view,
 * where its job is reassurance rather than interruption.
 */
function SatchelNudge() {
  const items = useAppStore((state) => state.satchelItems);
  const seenOn = useAppStore((state) => state.satchelNudgeSeenOn);
  const dismiss = useAppStore((state) => state.dismissSatchelNudge);
  const router = useRouter();
  const pathname = usePathname();
  const today = new Date().toISOString().slice(0, 10);
  const remaining = items.filter((item) => !item.purchased);
  const hidden =
    !remaining.length || seenOn === today || pathname === '/satchel' || pathname === '/browse';

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (hidden) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hidden, enter]);

  if (hidden) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 150,
        zIndex: 21,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <View
        style={[
          {
            backgroundColor: colors.white,
            borderColor: colors.mist,
            borderWidth: 1,
            borderRadius: 16,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          },
          elevation.lifted,
        ]}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.rosewoodSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Cat size={19} color={colors.rosewood} weight="fill" />
        </View>
        <Text
          style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.ink, lineHeight: 17 }}
        >
          {`${remaining.length} ${remaining.length === 1 ? 'thing is' : 'things are'} waiting in your Satchel. No rush — nothing expires.`}
        </Text>
        <Pressable onPress={() => router.push('/satchel' as Href)} hitSlop={8}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.rosewood }}>Open</Text>
        </Pressable>
        <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel="Dismiss">
          <X size={15} color={colors.inkSoft} weight="bold" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * The cat-bag itself. Carried across every screen including the in-app store
 * view, so stepping out to buy something never feels like being cut loose.
 */
export function SatchelWidget() {
  const items = useAppStore((state) => state.satchelItems);
  const pulse = useAppStore((state) => state.satchelPulse);
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const scale = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  const inStoreView = pathname === '/browse';

  useEffect(() => {
    if (!pulse || inStoreView) return;
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.22, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: -1, duration: 150, useNativeDriver: true }),
        Animated.spring(tilt, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]),
    ]).start();
  }, [pulse, inStoreView, scale, tilt]);

  if (pathname === '/satchel') return null;
  const inTabs = segments[0] === '(tabs)';
  const count = items.length;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 14,
        bottom: inTabs ? 78 : 24,
        zIndex: 20,
        transform: [
          { scale },
          { rotate: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) },
        ],
      }}
    >
      <Pressable
        onPress={() => router.push('/satchel' as Href)}
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.rosewood,
            alignItems: 'center',
            justifyContent: 'center',
          },
          elevation.lifted,
        ]}
        accessibilityRole="button"
        accessibilityLabel={count ? `Open Satchel, ${count} collected` : 'Open Satchel'}
      >
        <Handbag size={24} color={colors.white} weight={count > 0 ? 'fill' : 'regular'} />
        {count > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 20,
              height: 20,
              paddingHorizontal: 4,
              borderRadius: 10,
              backgroundColor: colors.honey,
              borderWidth: 2,
              borderColor: colors.shell,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.ink }}>{count}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
