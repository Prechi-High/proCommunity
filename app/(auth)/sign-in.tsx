import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Caption, Eyebrow, Heading, Wordmark } from '@/components/ui';
import { Check, Scales, ShieldCheck } from '@/components/icons';
import { colors, fonts, radii, scrimGradient } from '@/constants/theme';
import { ONBOARDING_PHOTO_ID, photo } from '@/lib/photos';
import { useAppStore } from '@/lib/store';

/**
 * 01 — Onboarding.
 *
 * The feeling to produce is relief, not excitement: "finally, something built
 * to help me decide, not sell to me." So the risk-reducers come *before* the
 * ask, and there is nothing anywhere on this screen that implies a deadline,
 * a limited place, or a reason to hurry.
 */
const PROMISES = [
  { icon: Scales, text: 'No store pays to rank higher here' },
  { icon: ShieldCheck, text: 'Critical traces stay up, not just the glowing ones' },
  { icon: Check, text: 'Browse the whole catalog before you tell us anything' },
];

export default function SignInScreen() {
  const router = useRouter();
  const signIn = useAppStore((state) => state.signIn);
  const [email, setEmail] = useState('');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.wine }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* A real, unhurried photograph — the emotional register is set before a
            single word is read. */}
        <View style={{ flexGrow: 1, minHeight: 268 }}>
          <Image
            source={{ uri: photo(ONBOARDING_PHOTO_ID, 900, 1100) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={scrimGradient.strong}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 210 }}
          />
          <View style={{ position: 'absolute', left: 22, right: 22, bottom: 20, gap: 8 }}>
            <Wordmark size={17} color={colors.white} />
            <Heading size={31} color={colors.white}>
              Know before{'\n'}you buy.
            </Heading>
          </View>
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 20, gap: 18 }}>
          <Body>
            Real experience from people who actually used it — what worked, what did not, and how long
            it took.
          </Body>

          {/* Risk comes down before commitment is asked for. */}
          <View style={{ gap: 11 }}>
            {PROMISES.map(({ icon: IconCmp, text }) => (
              <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.sageSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCmp size={14} color={colors.sage} weight="bold" />
                </View>
                <Text
                  style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink, lineHeight: 18 }}
                >
                  {text}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 10, marginTop: 4 }}>
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
            <Button
              label="Continue with Google"
              kind="quiet"
              onPress={() => {
                signIn('preview@sourced.local', 'You');
                router.replace('/(onboarding)/profile');
              }}
            />
          </View>

          <View style={{ paddingBottom: 18, paddingTop: 2 }}>
            <Caption>
              No card, no newsletter. By continuing you agree to our Terms and Privacy Policy.
            </Caption>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
