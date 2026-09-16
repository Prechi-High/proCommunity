import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Body, Button, Caption, Eyebrow, Heading, Wordmark } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { useAppStore } from '@/lib/store';

export default function SignInScreen() {
  const router = useRouter();
  const signIn = useAppStore((state) => state.signIn);
  const [email, setEmail] = useState('');

  return (
    <Screen
      footer={
        <Caption>
          By continuing you agree to our Terms and Privacy Policy.
        </Caption>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: 14, paddingHorizontal: 8 }}>
        <Wordmark size={26} />
        <Heading size={28}>Know before{'\n'}you buy.</Heading>
        <Body>
          Real experience from people who've actually used it — not just star ratings.
        </Body>
        <View style={{ marginTop: 18, gap: 10 }}>
          <Eyebrow>Email or phone</Eyebrow>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.inkSoft}
            value={email}
            onChangeText={setEmail}
            style={{
              backgroundColor: colors.white,
              borderColor: colors.mist,
              borderWidth: 1,
              borderRadius: radii.button,
              paddingHorizontal: 14,
              paddingVertical: 14,
              fontFamily: fonts.regular,
              fontSize: 14,
              color: colors.ink,
            }}
          />
          <Button
            label="Continue"
            disabled={!email.includes('@')}
            onPress={() => {
              signIn(email);
              router.replace('/(onboarding)/profile');
            }}
          />
          <View style={{ height: 1, backgroundColor: colors.mist, marginVertical: 8 }} />
          <Button
            label="Continue with Google"
            kind="outline"
            onPress={() => {
              signIn('preview@sourced.local', 'You');
              router.replace('/(onboarding)/profile');
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
