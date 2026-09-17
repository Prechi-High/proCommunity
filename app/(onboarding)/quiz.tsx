import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Body, Button, Caption, Eyebrow, Heading, Notice } from '@/components/ui';
import { BackButton, Check, Lightbulb, PencilSimple, Sparkle } from '@/components/icons';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { inferSkinType, QUIZ_QUESTIONS, SKIN_TYPE_LABEL } from '@/lib/quiz';
import { useAppStore } from '@/lib/store';

/**
 * 01b — Skin type quiz.
 *
 * Curiosity, not clinical assessment. Every question is answerable in a second
 * from lived experience, the progress bar shows how short this is, and the
 * result is framed as an estimate the user owns and can overrule — never a
 * verdict handed down.
 */
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
              label="Sounds right — use this"
              icon={Check}
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
            <Button
              label="Not quite — I'll pick myself"
              kind="quiet"
              icon={PencilSimple}
              onPress={() => router.back()}
            />
          </>
        }
      >
        <View style={{ gap: 14, paddingTop: 12 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.honeySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkle size={25} color={colors.honey} weight="fill" />
          </View>

          <Eyebrow>Our best guess</Eyebrow>
          <Heading size={27}>
            Your answers look most like {SKIN_TYPE_LABEL[inferred].toLowerCase()} skin
          </Heading>
          <Body>
            That is an estimate from five questions, not a diagnosis — and it is yours to overrule. We
            only use it to judge how well a product might fit you.
          </Body>

          <Notice icon={Lightbulb}>
            Skin shifts with weather, hormones and whatever you used last month. Treat this as a
            starting point and change it whenever it stops matching.
          </Notice>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={index === QUIZ_QUESTIONS.length - 1 ? 'See my estimate' : 'Next'}
          disabled={!selected}
          onPress={() => {
            if (index === QUIZ_QUESTIONS.length - 1) setDone(true);
            else setIndex((value) => value + 1);
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton onPress={() => (index === 0 ? router.back() : setIndex((value) => value - 1))} />
        <View style={{ flex: 1, height: 5, backgroundColor: colors.mist, borderRadius: 4 }}>
          <View
            style={{
              width: `${((index + 1) / QUIZ_QUESTIONS.length) * 100}%`,
              height: 5,
              backgroundColor: colors.rosewood,
              borderRadius: 4,
            }}
          />
        </View>
        <Caption>{`${index + 1}/${QUIZ_QUESTIONS.length}`}</Caption>
      </View>

      <View style={{ gap: 6, marginTop: 8 }}>
        <Heading size={23}>{question.prompt}</Heading>
        <Caption>Go with your first instinct. There is no wrong answer here.</Caption>
      </View>

      <View style={{ gap: 10, marginTop: 6 }}>
        {question.options.map((option) => {
          const on = selected === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: on }}
              style={[
                {
                  backgroundColor: on ? colors.rosewoodSoft : colors.white,
                  borderColor: on ? colors.rosewood : colors.mist,
                  borderWidth: 1.5,
                  borderRadius: radii.card,
                  paddingHorizontal: 15,
                  paddingVertical: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                },
                on ? elevation.raised : null,
              ]}
            >
              <View
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 11,
                  borderWidth: 1.5,
                  borderColor: on ? colors.rosewood : colors.mist,
                  backgroundColor: on ? colors.rosewood : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <Check size={12} color={colors.white} weight="bold" /> : null}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: on ? fonts.semibold : fonts.medium,
                  fontSize: 14,
                  color: colors.ink,
                  lineHeight: 19,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 'auto', paddingTop: 12 }}>
        <Notice quiet icon={Lightbulb}>
          Five questions, then an estimate you can change in settings at any time.
        </Notice>
      </View>
    </Screen>
  );
}
