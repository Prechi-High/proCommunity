import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Eyebrow, Heading, Notice } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { inferSkinType, QUIZ_QUESTIONS, SKIN_TYPE_LABEL } from '@/lib/quiz';
import { useAppStore } from '@/lib/store';

export default function QuizScreen() {
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const profile = useAppStore((state) => state.profile);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const question = QUIZ_QUESTIONS[index];
  const selected = answers[question?.id ?? ''];
  const inferred = inferSkinType(answers);

  if (done) {
    return (
      <Screen
        footer={
          <>
            <Button
              label="Use this estimate"
              onPress={() => {
                completeOnboarding({
                  displayName: profile?.displayName ?? '',
                  skinType: inferred,
                  skinTypeSource: 'quiz_estimated',
                  concerns: profile?.concerns ?? [],
                  quizAnswers: answers,
                });
                router.replace('/(tabs)');
              }}
            />
            <Button label="Adjust in settings later" kind="text" onPress={() => router.back()} />
          </>
        }
      >
        <Eyebrow>Estimate</Eyebrow>
        <Heading size={24}>
          Based on what you told us, you're likely {SKIN_TYPE_LABEL[inferred]}
        </Heading>
        <Caption>
          This is an estimate from your answers, not a diagnosis. You can change it anytime.
        </Caption>
        <Notice>
          Skin type can shift with weather, hormones, and products. Treat this as a starting point.
        </Notice>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={index === QUIZ_QUESTIONS.length - 1 ? 'See estimate' : 'Next'}
          disabled={!selected}
          onPress={() => {
            if (index === QUIZ_QUESTIONS.length - 1) setDone(true);
            else setIndex((value) => value + 1);
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => (index === 0 ? router.back() : setIndex((value) => value - 1))}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <View style={{ flex: 1, height: 4, backgroundColor: colors.mist, borderRadius: 4 }}>
          <View
            style={{
              width: `${((index + 1) / QUIZ_QUESTIONS.length) * 100}%`,
              height: 4,
              backgroundColor: colors.rosewood,
              borderRadius: 4,
            }}
          />
        </View>
      </View>
      <Eyebrow>{`Question ${index + 1} of ${QUIZ_QUESTIONS.length}`}</Eyebrow>
      <Heading size={21}>{question.prompt}</Heading>
      <View style={{ gap: 10, marginTop: 8 }}>
        {question.options.map((option) => {
          const on = selected === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
              style={{
                backgroundColor: on ? colors.rosewoodSoft : colors.white,
                borderColor: on ? colors.rosewood : colors.mist,
                borderWidth: 1.5,
                borderRadius: radii.card,
                padding: 14,
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: 'auto' }}>
        <Notice quiet>
          Your answers give us a starting point. You can change your skin type anytime in settings.
        </Notice>
      </View>
    </Screen>
  );
}
