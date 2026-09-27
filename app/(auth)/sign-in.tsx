import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ArrowLeft, Scales, SealCheck, ShieldCheck } from '@/components/icons';
import { LargeTitle, PrimaryButton } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { useAppStore } from '@/lib/store';

const PROMISES = [
  { icon: Scales, text: 'No seller pays to rank higher' },
  { icon: SealCheck, text: 'Every claim links to its source' },
  { icon: ShieldCheck, text: 'Search works without an account' },
];

export default function SignInScreen() {
  const router = useRouter();
  const signIn = useAppStore((state) => state.signIn);
  const [email, setEmail] = useState('');

  const done = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 24 }}>
        <PrimaryButton label="Back" icon={ArrowLeft} tone="plain" onPress={done} style={{ alignSelf: 'flex-start', height: 38 }} />
        <LargeTitle sub="Sign in to join product discussions. Everything else works without an account.">Join Sourced</LargeTitle>
        <View style={{ gap: 12 }}>
          {PROMISES.map(({ icon: I, text }) => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <I size={20} color={colors.hi} weight="bold" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone }}>{text}</Text>
            </View>
          ))}
        </View>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.bone3}
          value={email}
          onChangeText={setEmail}
          style={{
            backgroundColor: colors.lac,
            borderRadius: 14,
            paddingHorizontal: 16,
            height: 52,
            fontFamily: fonts.regular,
            fontSize: 16,
            color: colors.bone,
          }}
        />
        <PrimaryButton
          label="Continue"
          disabled={!email.includes('@')}
          onPress={() => {
            signIn(email);
            done();
          }}
        />
      </View>
    </Screen>
  );
}
