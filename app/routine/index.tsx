import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Card, Check, Chip, Heading, Thumb, Title } from '@/components/ui';
import { BackButton, HandHeart, Leaf, MoonStars, Plus, Sun, Trash } from '@/components/icons';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { getProduct } from '@/lib/catalog';
import { currentStreak, useAppStore } from '@/lib/store';
import { useProducts } from '@/lib/useProduct';

/**
 * 07 — Routine tracker.
 *
 * This is the screen most apps ruin with loss-averse streak mechanics. The
 * satisfaction here has to come from finishing a real, self-chosen task — so
 * progress is stated positively, the streak is mentioned but never defended,
 * and a missed day is met with "pick up where you left off" rather than
 * anything that reads as a penalty. Nothing on this screen uses the word lost,
 * broken, or don't.
 */
export default function RoutineScreen() {
  const router = useRouter();
  const [time, setTime] = useState<'am' | 'pm'>(new Date().getHours() >= 17 ? 'pm' : 'am');
  const allSteps = useAppStore((s) => s.routineSteps);
  const steps = allSteps.filter((step) => step.timeOfDay === time);
  useProducts(allSteps.map((step) => step.productId));
  const logs = useAppStore((s) => s.routineLogs);
  const toggleRoutineStep = useAppStore((s) => s.toggleRoutineStep);
  const removeRoutineStep = useAppStore((s) => s.removeRoutineStep);
  const today = new Date().toISOString().slice(0, 10);
  const log = logs.find((item) => item.date === today && item.timeOfDay === time);
  const streak = currentStreak(logs, allSteps);

  const ordered = steps.slice().sort((a, b) => a.stepOrder - b.stepOrder);
  const doneCount = ordered.filter((step) => log?.completedStepIds.includes(step.id)).length;
  const allDone = ordered.length > 0 && doneCount === ordered.length;
  const startedToday = doneCount > 0;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Heading size={19}>Today</Heading>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Morning" icon={Sun} selected={time === 'am'} onPress={() => setTime('am')} />
        <Chip label="Evening" icon={MoonStars} selected={time === 'pm'} onPress={() => setTime('pm')} />
      </View>

      {ordered.length > 0 ? (
        <Card
          level="raised"
          style={
            allDone
              ? { backgroundColor: colors.sageSoft, borderColor: colors.sageSoft, gap: 10 }
              : { gap: 10 }
          }
        >
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 19,
              color: colors.ink,
              letterSpacing: -0.4,
            }}
          >
            {allDone
              ? 'Done for this one'
              : startedToday
                ? `${doneCount} of ${ordered.length} done`
                : `${ordered.length} ${ordered.length === 1 ? 'step' : 'steps'} whenever you get to it`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {ordered.map((step) => (
              <View
                key={step.id}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: log?.completedStepIds.includes(step.id)
                    ? allDone
                      ? colors.sage
                      : colors.rosewood
                    : colors.mist,
                }}
              />
            ))}
          </View>
          {allDone ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <HandHeart size={14} color={colors.sage} weight="fill" />
              <Caption color={colors.sage}>
                That is the whole thing. Nothing else is waiting on you.
              </Caption>
            </View>
          ) : null}
        </Card>
      ) : null}

      {ordered.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 26 }}>
          <Sun size={26} color={colors.inkSoft} weight="regular" />
          <Title>{time === 'am' ? 'No morning steps yet' : 'No evening steps yet'}</Title>
          <Caption>Add a product and checking it off should take about a second.</Caption>
        </Card>
      ) : null}

      {ordered.map((step, index) => {
        const product = getProduct(step.productId);
        const done = log?.completedStepIds.includes(step.id) ?? false;
        return (
          <Pressable
            key={step.id}
            onPress={() => toggleRoutineStep(step.id, time)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`${product?.name ?? 'Product'}, step ${index + 1}`}
            style={[
              {
                backgroundColor: done ? colors.sageSoft : colors.white,
                borderColor: done ? colors.sageSoft : colors.mist,
                borderWidth: 1,
                borderRadius: radii.card,
                padding: 11,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              },
              done ? null : elevation.raised,
            ]}
          >
            <Check done={done} size={26} />
            <Thumb imageUrl={product?.heroImageUrl} category={product?.category} size={42} />
            <View style={{ flex: 1, gap: 2 }}>
              <Title>{product?.name ?? 'Product'}</Title>
              <Caption>{`Step ${index + 1}`}</Caption>
            </View>
            <Pressable
              onPress={() => removeRoutineStep(step.id)}
              hitSlop={10}
              accessibilityLabel={`Remove ${product?.name ?? 'this step'}`}
            >
              <Trash size={15} color={colors.inkSoft} weight="regular" />
            </Pressable>
          </Pressable>
        );
      })}

      <Button
        label="Add a step"
        kind="text"
        icon={Plus}
        onPress={() => router.push('/(tabs)/search')}
      />

      {/* Stated, then left alone. */}
      {streak > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            backgroundColor: colors.sageSoft,
            borderRadius: radii.card,
            padding: 13,
          }}
        >
          <Leaf size={17} color={colors.sage} weight="fill" />
          <View style={{ flex: 1 }}>
            <Title>{`${streak} ${streak === 1 ? 'day' : 'days'} in a row`}</Title>
            <Caption>Nice. It keeps counting whenever you come back to it.</Caption>
          </View>
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: colors.mist,
            padding: 13,
          }}
        >
          <Leaf size={17} color={colors.inkSoft} weight="regular" />
          <View style={{ flex: 1 }}>
            <Title>Pick up where you left off</Title>
            <Caption>Skipping a day changes nothing here. Consistency beats perfection.</Caption>
          </View>
        </View>
      )}
    </Screen>
  );
}
