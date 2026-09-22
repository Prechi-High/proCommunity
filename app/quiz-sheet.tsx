import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Heading } from '@/components/ui';
import { BackButton } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { FIT_QUIZ_QUESTIONS, SKIN_TYPE_LABEL } from '@/lib/quiz';
import { useAppStore } from '@/lib/store';
import type { SkinType } from '@/lib/types';

/**
 * 3-question fit quiz sheet from sourced-v1 (2).html.
 */
export default function QuizSheetScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const setGuestSkin = useAppStore((s) => s.setGuestSkin);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const question = FIT_QUIZ_QUESTIONS[index];
  const inferred = inferSkinFromFit(answers);

  const apply = (type: SkinType) => {
    if (profile) {
      updateProfile({ skinType: type, skinTypeSource: 'quiz_estimated' });
    } else {
      setGuestSkin(type, 'quiz_estimated');
    }
    router.back();
  };

  if (done) {
    return (
      <Screen>
        <BackButton />
        <Caption>Based on what you told us</Caption>
        <Heading size={30} style={{ marginTop: 6 }}>
          You’re likely {SKIN_TYPE_LABEL[inferred]}.
        </Heading>
        <Caption>This is an estimate, not a diagnosis. You can change it any time.</Caption>
        <Button label="Use this" kind="hl" style={{ marginTop: 20 }} onPress={() => apply(inferred)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <View
        style={{
          marginTop: 12,
          height: 4,
          borderRadius: 3,
          backgroundColor: colors.line,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${((index + 1) / FIT_QUIZ_QUESTIONS.length) * 100}%`,
            height: 4,
            backgroundColor: colors.hi,
          }}
        />
      </View>
      <Caption>Question {index + 1} of {FIT_QUIZ_QUESTIONS.length}</Caption>
      <Heading size={24} style={{ marginTop: 6 }}>
        {question.prompt}
      </Heading>
      {question.options.map((option) => {
        const sel = picked === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              setPicked(option.id);
              hapticSelect();
              const next = { ...answers, [question.id]: option.id };
              setAnswers(next);
              setTimeout(() => {
                if (index < FIT_QUIZ_QUESTIONS.length - 1) {
                  setIndex(index + 1);
                  setPicked(null);
                } else {
                  hapticSuccess();
                  setDone(true);
                }
              }, 280);
            }}
            style={{
              marginTop: 10,
              padding: 16,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: sel ? colors.bone : colors.line,
              backgroundColor: sel ? colors.bone : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 15,
                color: sel ? colors.wine : colors.bone,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      <Caption>Your answers give us a starting point. You can change your skin type any time.</Caption>
    </Screen>
  );
}

function inferSkinFromFit(answers: Record<string, string>): SkinType {
  const counts: Partial<Record<SkinType, number>> = {};
  for (const question of FIT_QUIZ_QUESTIONS) {
    const selected = question.options.find((option) => option.id === answers[question.id]);
    if (!selected) continue;
    counts[selected.type] = (counts[selected.type] ?? 0) + 1;
  }
  const ranked = (Object.entries(counts) as [SkinType, number][]).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? 'combination';
}
