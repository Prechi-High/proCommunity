import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, fonts } from '@/constants/theme';
import { currentSignIn } from '@/lib/auth';

/** Reserved for future OAuth redirects; email OTP uses verify-email instead. */
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    void currentSignIn().then((r) => {
      if (r) router.replace('/(tabs)');
      else router.replace('/(auth)/sign-in');
    });
  }, [router]);

  return (
    <Screen>
      <View style={{ paddingTop: 48, alignItems: 'center', gap: 12 }}>
        <ActivityIndicator color={colors.hi} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone3 }}>Finishing sign-in…</Text>
      </View>
    </Screen>
  );
}
