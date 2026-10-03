import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ArrowLeft } from '@/components/icons';
import { LargeTitle, PrimaryButton } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { setDisplayName } from '@/lib/auth';
import { OTP_CODE_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from '@/lib/auth/constants';
import { requestEmailCode } from '@/lib/services/auth/requestEmailCode';
import { verifyEmailCode } from '@/lib/services/auth/verifyEmailCode';
import { hapticSuccess } from '@/lib/haptics';

const OTP_LEN = OTP_CODE_LENGTH;

function normalizeReturnTo(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[]; returnTo?: string | string[] }>();
  const email = (Array.isArray(params.email) ? params.email[0] : params.email)?.trim().toLowerCase() ?? '';
  const returnTo = normalizeReturnTo(params.returnTo);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(OTP_RESEND_COOLDOWN_SECONDS);
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);
  const finished = useRef(false);

  useEffect(() => {
    if (!email) router.replace('/(auth)/sign-in');
  }, [email, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const done = () => {
    if (finished.current) return;
    finished.current = true;
    if (returnTo) router.replace(returnTo as Href);
    else router.replace('/(tabs)');
  };

  const verify = async (value = code) => {
    if (value.length !== OTP_LEN || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyEmailCode(email, value);
      hapticSuccess();
      if (result.needsName) setNeedsName(true);
      else done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code isn't correct. Check it and try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestEmailCode(email);
      setResendIn(OTP_RESEND_COOLDOWN_SECONDS);
      setCode('');
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please wait before requesting another code.');
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    setBusy(true);
    try {
      await setDisplayName(name);
      hapticSuccess();
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save name.');
    } finally {
      setBusy(false);
    }
  };

  if (!email) return null;

  if (needsName) {
    return (
      <Screen>
        <View style={{ paddingTop: 12, gap: 20 }}>
          <LargeTitle sub="Saved on your Unmask profile.">What should we call you?</LargeTitle>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            accessibilityLabel="Display name"
            placeholder="Your name"
            placeholderTextColor={colors.bone3}
            maxLength={40}
            style={{
              backgroundColor: colors.lac,
              borderRadius: 14,
              paddingHorizontal: 16,
              height: 54,
              fontFamily: fonts.regular,
              fontSize: 17,
              color: colors.bone,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          />
          <PrimaryButton label="Continue" disabled={name.trim().length < 2 || busy} onPress={() => void saveName()} />
        </View>
      </Screen>
    );
  }

  const digits = code.padEnd(OTP_LEN, ' ').split('').slice(0, OTP_LEN);

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 22 }}>
        <PrimaryButton
          label="Back"
          icon={ArrowLeft}
          tone="plain"
          onPress={() => router.replace('/(auth)/sign-in')}
          style={{ alignSelf: 'flex-start', height: 38 }}
        />

        <LargeTitle sub={`We sent a 6-digit code to\n${email}`}>Check your email</LargeTitle>

        <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button" accessibilityLabel="Verification code">
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {digits.map((d, i) => (
              <View
                key={i}
                style={{
                  width: 44,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.lac,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 22, color: colors.bone }}>{d.trim() ? d : ''}</Text>
              </View>
            ))}
          </View>
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(v) => {
            const digitsOnly = v.replace(/\D/g, '').slice(0, OTP_LEN);
            setCode(digitsOnly);
            if (digitsOnly.length === OTP_LEN) void verify(digitsOnly);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          accessibilityLabel="Six digit verification code"
          maxLength={OTP_LEN}
          autoFocus
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />

        <PrimaryButton label={busy ? 'Verifying…' : 'Verify email'} disabled={code.length !== OTP_LEN || busy} onPress={() => void verify()} />

        <Pressable disabled={resendIn > 0 || busy} onPress={() => void resend()} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: resendIn > 0 ? colors.bone3 : colors.hi }}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/(auth)/sign-in')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone3 }}>Use a different email</Text>
        </Pressable>

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
