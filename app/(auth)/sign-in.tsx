import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ArrowLeft, Scales, SealCheck, ShieldCheck } from '@/components/icons';
import { LargeTitle, PrimaryButton } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import {
  currentSignIn,
  fetchAuthHint,
  getLastSignedInEmail,
  resumeSession,
  sendCode,
  setDisplayName,
  setLoginPassword,
  signInWithPassword,
  verifyCode,
} from '@/lib/auth';
import { hapticSuccess } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';

const PROMISES = [
  { icon: Scales, text: 'No seller pays to rank higher' },
  { icon: SealCheck, text: 'Every claim links to its source' },
  { icon: ShieldCheck, text: 'This device keeps you signed in — no code every visit' },
];

type Step = 'email' | 'password' | 'code' | 'name' | 'set-password';

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
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(() => getLastSignedInEmail() ?? '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInput>(null);
  const lastEmail = getLastSignedInEmail();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const finished = useRef(false);
  const done = () => {
    if (finished.current) return;
    finished.current = true;
    if (returnTo) router.replace(returnTo as Href);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const finishSignIn = (needsName: boolean, offerPassword = false) => {
    hapticSuccess();
    if (needsName) setStep('name');
    else if (offerPassword) setStep('set-password');
    else done();
  };

  // Already signed in on this device — skip email and code.
  useEffect(() => {
    const adopt = async () => {
      const resumed = await resumeSession().catch(() => null);
      const r = resumed ?? (await currentSignIn());
      if (!r || finished.current) return;
      if (r.needsName) setStep('name');
      else done();
    };

    void adopt().finally(() => setChecking(false));

    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setTimeout(() => void adopt(), 0);
    });
    return () => sub?.data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

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

  const continueWithEmail = () =>
    run(async () => {
      const normalized = email.trim().toLowerCase();
      const resumed = await resumeSession(normalized);
      if (resumed) {
        finishSignIn(resumed.needsName);
        return;
      }

      const hint = await fetchAuthHint(normalized);
      if (hint.passwordSignIn) {
        setStep('password');
        return;
      }
      if (hint.registered) {
        await sendCode(normalized, returnTo ?? undefined, false);
        setStep('code');
        setCode('');
        setResendIn(45);
        setTimeout(() => codeRef.current?.focus(), 150);
        return;
      }

      await sendCode(normalized, returnTo ?? undefined, true);
      setStep('code');
      setCode('');
      setResendIn(45);
      setTimeout(() => codeRef.current?.focus(), 150);
    });

  const continueAsLast = () =>
    run(async () => {
      if (!lastEmail) return;
      setEmail(lastEmail);
      const resumed = await resumeSession(lastEmail);
      if (resumed) {
        finishSignIn(resumed.needsName);
        return;
      }
      const hint = await fetchAuthHint(lastEmail);
      if (hint.passwordSignIn) {
        setEmail(lastEmail);
        setStep('password');
        return;
      }
      setEmail(lastEmail);
      await sendCode(lastEmail, returnTo ?? undefined, false);
      setStep('code');
      setResendIn(45);
    });

  const submitPassword = () =>
    run(async () => {
      const { needsName } = await signInWithPassword(email, password);
      finishSignIn(needsName);
    });

  const requestCode = () =>
    run(async () => {
      const hint = await fetchAuthHint(email.trim().toLowerCase());
      await sendCode(email, returnTo ?? undefined, !hint.registered);
      setStep('code');
      setCode('');
      setResendIn(45);
      setTimeout(() => codeRef.current?.focus(), 150);
    });

  const submitCode = (value = code) =>
    run(async () => {
      const { needsName } = await verifyCode(email, value);
      const hint = await fetchAuthHint(email.trim().toLowerCase());
      finishSignIn(needsName, !hint.passwordSignIn);
    });

  const saveName = () =>
    run(async () => {
      await setDisplayName(name);
      hapticSuccess();
      setStep('set-password');
    });

  const savePassword = () =>
    run(async () => {
      await setLoginPassword(newPassword);
      hapticSuccess();
      done();
    });

  if (checking) {
    return (
      <Screen>
        <View style={{ paddingTop: 48, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.hi} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone3 }}>Checking your session…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 24 }}>
        <PrimaryButton
          label="Back"
          icon={ArrowLeft}
          tone="plain"
          onPress={() => {
            if (step === 'code' || step === 'password') setStep('email');
            else done();
          }}
          style={{ alignSelf: 'flex-start', height: 38 }}
        />

        {step === 'email' ? (
          <>
            <LargeTitle
              sub={
                returnTo === '/admin'
                  ? 'If this device already knows your account, you go straight in. Otherwise use your password or a one-time email code.'
                  : 'Already joined? Enter your email — we open your account on this device when we can, or ask for your password.'
              }
            >
              {returnTo ? 'Sign in' : 'Welcome back'}
            </LargeTitle>
            {lastEmail ? (
              <PrimaryButton
                label={busy ? 'Opening…' : `Continue as ${lastEmail}`}
                disabled={busy}
                onPress={continueAsLast}
              />
            ) : null}
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
              placeholder="you@example.com"
              placeholderTextColor={colors.bone3}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => validEmail && !busy && continueWithEmail()}
              style={inputStyle}
            />
            <PrimaryButton label={busy ? 'Continuing…' : 'Continue'} disabled={!validEmail || busy} onPress={continueWithEmail} />
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <LargeTitle sub={`Sign in to ${email.trim().toLowerCase()}`}>Your password</LargeTitle>
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={colors.bone3}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => password.length >= 8 && !busy && submitPassword()}
              style={inputStyle}
            />
            <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} disabled={password.length < 8 || busy} onPress={submitPassword} />
            <Pressable disabled={busy} onPress={requestCode} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>Email me a code instead</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'code' ? (
          <>
            <LargeTitle sub={`We emailed ${email.trim().toLowerCase()}. Enter the 6-digit code, or open the sign-in link on this device.`}>Check your email</LargeTitle>
            <TextInput
              ref={codeRef}
              value={code}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 8);
                setCode(digits);
                if (digits.length === 6 && !busy) void submitCode(digits);
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="••••••"
              placeholderTextColor={colors.bone3}
              maxLength={8}
              style={[inputStyle, { fontFamily: fonts.semibold, fontSize: 26, letterSpacing: 10, textAlign: 'center', height: 64 }] as never}
            />
            <PrimaryButton label={busy ? 'Checking…' : 'Verify'} disabled={code.length < 6 || busy} onPress={() => submitCode()} />
            <Pressable disabled={resendIn > 0 || busy} onPress={requestCode} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: resendIn > 0 ? colors.bone3 : colors.hi }}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {step === 'name' ? (
          <>
            <LargeTitle sub="This is the name people see next to your questions and stories.">What should we call you?</LargeTitle>
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              placeholder="Your name or nickname"
              placeholderTextColor={colors.bone3}
              maxLength={40}
              onSubmitEditing={() => name.trim().length >= 2 && saveName()}
              style={inputStyle}
            />
            <PrimaryButton label="Continue" disabled={name.trim().length < 2 || busy} onPress={saveName} />
            <Pressable onPress={() => setStep('set-password')} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone3 }}>Skip for now</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'set-password' ? (
          <>
            <LargeTitle sub="Next time you can enter email + password on a new device — no code unless you prefer it.">Set a login password</LargeTitle>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor={colors.bone3}
              value={newPassword}
              onChangeText={setNewPassword}
              onSubmitEditing={() => newPassword.trim().length >= 8 && savePassword()}
              style={inputStyle}
            />
            <PrimaryButton label={busy ? 'Saving…' : 'Save password'} disabled={newPassword.trim().length < 8 || busy} onPress={savePassword} />
            <Pressable onPress={done} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone3 }}>Skip — stay signed in on this device only</Text>
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
