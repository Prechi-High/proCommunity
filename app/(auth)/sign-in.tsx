import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ArrowLeft, Scales, SealCheck, ShieldCheck } from '@/components/icons';
import { LargeTitle, PrimaryButton } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { currentSignIn, sendCode, setDisplayName, verifyCode } from '@/lib/auth';
import { hapticSuccess } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';

const PROMISES = [
  { icon: Scales, text: 'No seller pays to rank higher' },
  { icon: SealCheck, text: 'Every claim links to its source' },
  { icon: ShieldCheck, text: 'No password — just a code to your email' },
];

type Step = 'email' | 'code' | 'name';

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

export default function SignInScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const finished = useRef(false);
  const done = () => {
    if (finished.current) return;
    finished.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // Opening the emailed link signs in without a code, in this tab or another one.
  useEffect(() => {
    const adopt = () =>
      void currentSignIn().then((r) => {
        if (!r || finished.current) return;
        setStep((s) => {
          if (s === 'name') return s;
          if (r.needsName) return 'name';
          setTimeout(done, 0);
          return s;
        });
      });
    adopt();
    // Supabase auth calls inside the listener must be deferred to avoid a lock deadlock.
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setTimeout(adopt, 0);
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

  const requestCode = () =>
    run(async () => {
      await sendCode(email);
      setStep('code');
      setCode('');
      setResendIn(45);
      setTimeout(() => codeRef.current?.focus(), 150);
    });

  const submitCode = (value = code) =>
    run(async () => {
      const { needsName } = await verifyCode(email, value);
      hapticSuccess();
      if (needsName) setStep('name');
      else done();
    });

  const saveName = () =>
    run(async () => {
      await setDisplayName(name);
      hapticSuccess();
      done();
    });

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 24 }}>
        <PrimaryButton
          label="Back"
          icon={ArrowLeft}
          tone="plain"
          onPress={() => (step === 'code' ? setStep('email') : done())}
          style={{ alignSelf: 'flex-start', height: 38 }}
        />

        {step === 'email' ? (
          <>
            <LargeTitle sub="Sign in to post in discussions, save products across devices and keep your Research Cards.">Join Sourced</LargeTitle>
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
              onSubmitEditing={() => validEmail && !busy && requestCode()}
              style={inputStyle}
            />
            <PrimaryButton label={busy ? 'Sending code…' : 'Email me a code'} disabled={!validEmail || busy} onPress={requestCode} />
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
            <Pressable onPress={done} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone3 }}>Skip for now</Text>
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
