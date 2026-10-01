import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, fonts } from '@/constants/theme';
import { completeAuthFromUrl, currentSignIn, setDisplayName } from '@/lib/auth';
import { hapticSuccess } from '@/lib/haptics';
import { Platform, TextInput } from 'react-native';

import { LargeTitle, PrimaryButton } from '@/components/kit';

function normalizeReturnTo(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = normalizeReturnTo(returnToParam);
  const [error, setError] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    if (returnTo) router.replace(returnTo as Href);
    else router.replace('/(tabs)');
  };

  useEffect(() => {
    void (async () => {
      try {
        const existing = await currentSignIn();
        if (existing) {
          if (existing.needsName) setNeedsName(true);
          else finish();
          return;
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const result = await completeAuthFromUrl(window.location.href);
          if (result.needsName) setNeedsName(true);
          else finish();
          return;
        }
        setError('Open the sign-in link on the same device, or use Google / email and password in the app.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not finish sign-in.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveName = async () => {
    setBusy(true);
    try {
      await setDisplayName(name);
      hapticSuccess();
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save name.');
    } finally {
      setBusy(false);
    }
  };

  if (needsName) {
    return (
      <Screen>
        <View style={{ paddingTop: 24, gap: 16 }}>
          <LargeTitle sub="Stored on your Sourced account in the database.">What should we call you?</LargeTitle>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
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
          <PrimaryButton label={busy ? 'Saving…' : 'Continue'} disabled={name.trim().length < 2 || busy} onPress={() => void saveName()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: 48, alignItems: 'center', gap: 12 }}>
        {error ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.coral, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator color={colors.hi} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone3 }}>Finishing sign-in…</Text>
          </>
        )}
      </View>
    </Screen>
  );
}
