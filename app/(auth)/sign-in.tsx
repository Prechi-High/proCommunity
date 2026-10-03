import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/Screen';
import { ArrowLeft, GoogleLogo, Scales, SealCheck, ShieldCheck } from '@/components/icons';
import { LargeTitle, PrimaryButton } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { currentSignIn } from '@/lib/auth';
import { requestEmailCode } from '@/lib/services/auth/requestEmailCode';

const emailSchema = z.string().trim().email().max(320);

const inputStyle = {
  backgroundColor: colors.lac,
  borderRadius: 14,
  paddingHorizontal: 16,
  height: 54,
  fontFamily: fonts.regular,
  fontSize: 17,
  color: colors.bone,
  borderWidth: 1,
  borderColor: colors.line,
  outlineStyle: 'none',
} as never;

function normalizeReturnTo(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function SignInScreen() {
  const router = useRouter();
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = normalizeReturnTo(returnToParam);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(false);

  const done = () => {
    if (finished.current) return;
    finished.current = true;
    if (returnTo) router.replace(returnTo as Href);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  useEffect(() => {
    void currentSignIn()
      .then((r) => {
        if (r && !finished.current) done();
      })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validEmail = emailSchema.safeParse(email).success;

  const continueEmail = async () => {
    setBusy(true);
    setError(null);
    try {
      const normalized = emailSchema.parse(email.trim().toLowerCase());
      await requestEmailCode(normalized);
      router.push({
        pathname: '/(auth)/verify-email',
        params: { email: normalized, ...(returnTo ? { returnTo } : {}) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <Screen>
        <View style={{ paddingTop: 48, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 22 }}>
        <PrimaryButton label="Back" icon={ArrowLeft} tone="plain" onPress={done} style={{ alignSelf: 'flex-start', height: 38 }} />

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.bone, letterSpacing: 1 }}>Sourced</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone3 }}>Know before you buy.</Text>
        </View>

        <Pressable
          disabled
          accessibilityState={{ disabled: true }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.lac,
            borderWidth: 1,
            borderColor: colors.line,
            opacity: 0.45,
          }}
        >
          <GoogleLogo size={22} color={colors.bone3} weight="bold" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone3 }}>Continue with Google</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, textAlign: 'center' }}>Google sign-in coming soon</Text>

        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone3, textAlign: 'center' }}>or use email</Text>

        <View style={{ gap: 12 }}>
          {[
            { icon: Scales, text: 'No seller pays to rank higher' },
            { icon: SealCheck, text: 'Every claim links to its source' },
            { icon: ShieldCheck, text: 'Your account is stored securely in Supabase' },
          ].map(({ icon: I, text }) => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <I size={20} color={colors.hi} weight="bold" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone }}>{text}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone3 }}>Email address</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          accessibilityLabel="Email address"
          placeholder="you@example.com"
          placeholderTextColor={colors.bone3}
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => validEmail && !busy && void continueEmail()}
          style={inputStyle}
        />

        <PrimaryButton label={busy ? 'Sending code…' : 'Continue'} disabled={!validEmail || busy} onPress={() => void continueEmail()} />

        {busy ? <ActivityIndicator color={colors.hi} /> : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.coral, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
