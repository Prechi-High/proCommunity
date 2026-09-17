import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter, useSegments, type Href } from 'expo-router';

import { colors, fonts } from '@/constants/theme';
import { useAppStore } from '@/lib/store';

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

function SatchelNudge() {
  const items = useAppStore((state) => state.satchelItems);
  const seenOn = useAppStore((state) => state.satchelNudgeSeenOn);
  const dismiss = useAppStore((state) => state.dismissSatchelNudge);
  const router = useRouter();
  const pathname = usePathname();
  const today = new Date().toISOString().slice(0, 10);
  const remaining = items.filter((item) => !item.purchased);
  if (!remaining.length || seenOn === today || pathname === '/satchel') return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: 150, zIndex: 21 }}
    >
      <View
        style={{
          backgroundColor: colors.white,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: colors.ink,
          shadowOpacity: 0.08,
          shadowRadius: 12,
        }}
      >
        <Text style={{ fontSize: 18 }}>🐱</Text>
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.ink, lineHeight: 16 }}>
          {`You still have ${remaining.length} ${remaining.length === 1 ? 'item' : 'items'} in your Satchel`}
        </Text>
        <Pressable onPress={() => router.push('/satchel' as Href)}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.rosewood }}>Open</Text>
        </Pressable>
        <Pressable onPress={dismiss}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft }}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SatchelWidget() {
  const items = useAppStore((state) => state.satchelItems);
  const pulse = useAppStore((state) => state.satchelPulse);
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 140, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [pulse, scale]);

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
        transform: [{ scale }],
      }}
    >
      <Pressable
        onPress={() => router.push('/satchel' as Href)}
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: colors.rosewood,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.rosewood,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
        accessibilityLabel="Open Satchel"
      >
        <Text style={{ fontSize: 22 }}>🐱</Text>
        {count > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 19,
              height: 19,
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
