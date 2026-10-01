import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ArrowLeft, GoogleLogo, Scales, SealCheck, ShieldCheck } from '@/components/icons';
import { LargeTitle, PrimaryButton } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import {
  currentSignIn,
  sendMagicLink,
  sendPasswordReset,
  setDisplayName,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/auth';
import { hapticSuccess } from '@/lib/haptics';

const PROMISES = [
  { icon: Scales, text: 'No seller pays to rank higher' },
  { icon: SealCheck, text: 'Every claim links to its source' },
  { icon: ShieldCheck, text: 'Your account lives in Sourced — not a guest profile on this device' },
];

type Mode = 'sign-in' | 'sign-up';
type Step = 'form' | 'name' | 'check-email' | 'reset-sent' | 'magic-sent';

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
  const [mode, setMode] = useState<Mode>('sign-in');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
        if (!r || finished.current) return;
        if (r.needsName) setStep('name');
        else done();
      })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const validPassword = password.length >= 8;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitEmailPassword = () =>
    run(async () => {
      if (mode === 'sign-up') {
        const { needsEmailConfirm, needsName } = await signUpWithEmail(email, password, returnTo ?? undefined);
        hapticSuccess();
        if (needsEmailConfirm) {
          setStep('check-email');
          return;
        }
        if (needsName) setStep('name');
        else done();
        return;
      }
      const { needsName } = await signInWithEmail(email, password);
      hapticSuccess();
      if (needsName) setStep('name');
      else done();
    });

  const google = () =>
    run(async () => {
      await signInWithGoogle(returnTo ?? undefined);
    });

  const magicLink = () =>
    run(async () => {
      await sendMagicLink(email, returnTo ?? undefined);
      setStep('magic-sent');
    });

  const resetPassword = () =>
    run(async () => {
      await sendPasswordReset(email);
      setStep('reset-sent');
    });

  const saveName = () =>
    run(async () => {
      await setDisplayName(name);
      hapticSuccess();
      done();
    });

  if (checking) {
    return (
      <Screen>
        <View style={{ paddingTop: 48, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.hi} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone3 }}>Loading your account…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 22 }}>
        <PrimaryButton
          label="Back"
          icon={ArrowLeft}
          tone="plain"
          onPress={() => (step === 'form' ? done() : setStep('form'))}
          style={{ alignSelf: 'flex-start', height: 38 }}
        />

        {step === 'form' ? (
          <>
            <LargeTitle
              sub={
                returnTo === '/admin'
                  ? 'Sign in with Google or the email and password on your Sourced account (stored in Supabase).'
                  : 'Create an account or sign in. Members, saves, and admin access are tied to your database user.'
              }
            >
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </LargeTitle>

            <Pressable
              onPress={() => void google()}
              disabled={busy}
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
                opacity: busy ? 0.6 : 1,
              }}
            >
              <GoogleLogo size={22} color={colors.bone} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>Continue with Google</Text>
            </Pressable>

            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone3, textAlign: 'center' }}>or use email</Text>

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
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              placeholder="Email"
              placeholderTextColor={colors.bone3}
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />
            <TextInput
              autoCapitalize="none"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'password'}
              secureTextEntry
              placeholder="Password (8+ characters)"
              placeholderTextColor={colors.bone3}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => validEmail && validPassword && submitEmailPassword()}
              style={inputStyle}
            />

            <PrimaryButton
              label={busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
              disabled={!validEmail || !validPassword || busy}
              onPress={submitEmailPassword}
            />

            <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>
                {mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
              </Text>
            </Pressable>

            {mode === 'sign-in' ? (
              <View style={{ gap: 10, alignItems: 'center' }}>
                <Pressable disabled={!validEmail || busy} onPress={resetPassword} hitSlop={8}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone3 }}>Forgot password?</Text>
                </Pressable>
                <Pressable disabled={!validEmail || busy} onPress={magicLink} hitSlop={8}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone3 }}>Email me a sign-in link instead</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        {step === 'check-email' ? (
          <>
            <LargeTitle sub={`We sent a confirmation link to ${email.trim().toLowerCase()}. Open it to activate your account.`}>
              Confirm your email
            </LargeTitle>
            <PrimaryButton label="Back to sign in" onPress={() => setStep('form')} />
          </>
        ) : null}

        {step === 'magic-sent' ? (
          <>
            <LargeTitle sub={`Open the link we sent to ${email.trim().toLowerCase()}. It returns you to Sourced and signs you in.`}>Check your email</LargeTitle>
            <PrimaryButton label="Back" onPress={() => setStep('form')} />
          </>
        ) : null}

        {step === 'reset-sent' ? (
          <>
            <LargeTitle sub={`If ${email.trim().toLowerCase()} has an account, you will get a reset link shortly.`}>Password reset sent</LargeTitle>
            <PrimaryButton label="Back to sign in" onPress={() => setStep('form')} />
          </>
        ) : null}

        {step === 'name' ? (
          <>
            <LargeTitle sub="Saved on your profile in the database.">Display name</LargeTitle>
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              placeholder="Your name"
              placeholderTextColor={colors.bone3}
              maxLength={40}
              onSubmitEditing={() => name.trim().length >= 2 && saveName()}
              style={inputStyle}
            />
            <PrimaryButton label="Continue" disabled={name.trim().length < 2 || busy} onPress={saveName} />
            <Pressable onPress={done} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone3 }}>Skip</Text>
            </Pressable>
          </>
        ) : null}

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
