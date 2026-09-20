import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Body, Button, Caption, Chip, Eyebrow, Heading, Notice } from '@/components/ui';
import { ArrowRight, CaretRight, Lock, Question } from '@/components/icons';
import { colors, fonts, radii } from '@/constants/theme';
import { CONCERN_LABEL } from '@/lib/quiz';
import { useAppStore } from '@/lib/store';
import type { Concern, SkinType } from '@/lib/types';

const SKIN_OPTIONS: SkinType[] = ['dry', 'oily', 'combination', 'sensitive', 'normal'];
const SKIN_LABEL: Record<string, string> = {
  dry: 'Dry',
  oily: 'Oily',
  combination: 'Combination',
  sensitive: 'Sensitive',
  normal: 'Normal',
};
const CONCERNS: Concern[] = [
  'acne',
  'aging',
  'hyperpigmentation',
  'sensitivity',
  'dryness',
  'oiliness',
  'redness',
];

/**
 * 01 (continued) — the skip-friendly profile step.
 *
 * Autonomy is the whole point: the user decides how much to invest. "Skip"
 * is therefore a real, visible button, not a greyed-out afterthought, and
 * every label says what the answer is *for* rather than demanding it.
 */
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
            icon={ArrowRight}
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
            label="Skip — I'll just look around"
            kind="quiet"
            onPress={() => {
              skipOnboarding();
              router.replace('/(tabs)');
            }}
          />
        </>
      }
    >
      <View style={{ gap: 6, paddingTop: 8 }}>
        <Eyebrow>Optional — skip anytime</Eyebrow>
        <Heading size={26}>A little about your skin</Heading>
        <Body>
          Only used to work out how well a product fits you. Search works fine without it, and you can
          change any of this later.
        </Body>
      </View>

      <View style={{ gap: 8 }}>
        <Eyebrow>What should we call you?</Eyebrow>
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
            fontSize: 14,
            color: colors.ink,
          }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Eyebrow>Skin type</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SKIN_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={SKIN_LABEL[option]}
              selected={skinType === option}
              onPress={() => setSkinType(option)}
            />
          ))}
        </View>
        <Pressable
          onPress={() => router.push('/(onboarding)/quiz')}
          accessibilityRole="button"
          accessibilityLabel="Not sure? Take five quick questions"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.mist,
            borderRadius: radii.card,
            padding: 12,
            marginTop: 2,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.rosewoodSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Question size={16} color={colors.rosewood} weight="regular" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
              Not sure? Five quick questions
            </Text>
            <Caption>No wrong answers — it only gives you an estimate.</Caption>
          </View>
          <CaretRight size={14} color={colors.inkSoft} weight="bold" />
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Eyebrow>Anything you're working on?</Eyebrow>
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
      </View>

      <Notice quiet icon={Lock}>
        This stays on your account and shapes only your own recommendations. It is never sold and never
        shown to other members.
      </Notice>
    </Screen>
  );
}
