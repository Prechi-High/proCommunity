import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ActionButton, AppShell, ClarityLayers, StoryCard } from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { currentSignIn } from '@/lib/auth';
import { markEntrySeen } from '@/lib/entry/api';
import { SAMPLE_FEED } from '@/lib/unmask/samples';

export default function Welcome() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void currentSignIn()
      .then((session) => {
        if (active && session) router.replace('/(tabs)' as Href);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);

  const go = async (path: '/(tabs)' | '/(auth)/sign-in' | '/contribute') => {
    await markEntrySeen().catch(() => undefined);
    router.replace(path as Href);
  };

  return (
    <AppShell flush>
      <View style={{ paddingHorizontal: 20, paddingTop: 28, gap: 14 }}>
        <Text
          style={{
            fontFamily: fonts.serifBold,
            fontSize: 40,
            lineHeight: 44,
            color: colors.ink,
            letterSpacing: -0.8,
          }}
        >
          {COPY.welcomeTitle}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: colors.inkSoft }}>
          {COPY.welcomeSupport}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <ClarityLayers />
      </View>
      <View style={{ paddingTop: 20 }}>
        <StoryCard item={SAMPLE_FEED[0]} flush />
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 10 }}>
        <ActionButton label={COPY.welcomeExplore} onPress={() => void go('/(tabs)')} />
        <ActionButton tone="secondary" label={COPY.welcomeShare} onPress={() => void go('/contribute')} />
        <ActionButton tone="ghost" label="Sign in with email" onPress={() => void go('/(auth)/sign-in')} />
      </View>
    </AppShell>
  );
}
