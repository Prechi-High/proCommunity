import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Body, Button, Caption, Chip, Heading } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { CONCERN_LABEL } from '@/lib/quiz';
import { useAppStore } from '@/lib/store';
import type { Concern, SkinType } from '@/lib/types';

const SKIN_OPTIONS: SkinType[] = ['dry', 'oily', 'combination', 'sensitive', 'normal'];
const CONCERNS: Concern[] = [
  'acne',
  'aging',
  'hyperpigmentation',
  'sensitivity',
  'dryness',
  'oiliness',
  'redness',
];

export default function ProfileSetup() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const skipOnboarding = useAppStore((state) => state.skipOnboarding);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [skinType, setSkinType] = useState<SkinType>(profile?.skinType ?? 'unknown');
  const [concerns, setConcerns] = useState<Concern[]>(profile?.concerns ?? []);

  return (
    <Screen
      footer={
        <>
          <Button
            label="Save and continue"
            onPress={() => {
              completeOnboarding({
                displayName: name,
                skinType,
                skinTypeSource: skinType === 'unknown' ? null : 'self_selected',
                concerns,
              });
              router.replace('/(tabs)');
            }}
          />
          <Button
            label="Skip for now"
            kind="text"
            onPress={() => {
              skipOnboarding();
              router.replace('/(tabs)');
            }}
          />
        </>
      }
    >
      <Heading size={24}>Help us tailor this to you</Heading>
      <Body>
        Optional. You can search right away. Fit matching improves once this is filled in.
      </Body>

      <Caption>What should we call you?</Caption>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={colors.inkSoft}
        style={{
          backgroundColor: colors.white,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: radii.button,
          paddingHorizontal: 14,
          paddingVertical: 14,
          fontFamily: fonts.regular,
          color: colors.ink,
        }}
      />

      <Caption>Skin type</Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SKIN_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={skinType === option}
            onPress={() => setSkinType(option)}
          />
        ))}
      </View>
      <Pressable onPress={() => router.push('/(onboarding)/quiz')}>
        <Text style={{ fontFamily: fonts.semibold, color: colors.rosewood, fontSize: 13 }}>
          Not sure? Take a quick quiz
        </Text>
      </Pressable>

      <Caption>Key concerns</Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CONCERNS.map((concern) => (
          <Chip
            key={concern}
            label={CONCERN_LABEL[concern]}
            selected={concerns.includes(concern)}
            onPress={() =>
              setConcerns((current) =>
                current.includes(concern)
                  ? current.filter((item) => item !== concern)
                  : [...current, concern],
              )
            }
          />
        ))}
      </View>
      <Caption>Used only to improve your own recommendations. Not sold to anyone.</Caption>
    </Screen>
  );
}
