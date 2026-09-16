import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Card, Check, Chip, Heading, Thumb, Title } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { getProduct } from '@/lib/catalog';
import { currentStreak, useAppStore } from '@/lib/store';
import { useProducts } from '@/lib/useProduct';

export default function RoutineScreen() {
  const router = useRouter();
  const [time, setTime] = useState<'am' | 'pm'>('am');
  const steps = useAppStore((s) => s.routineSteps).filter((step) => step.timeOfDay === time);
  const allSteps = useAppStore((s) => s.routineSteps);
  useProducts(allSteps.map((step) => step.productId));
  const logs = useAppStore((s) => s.routineLogs);
  const toggleRoutineStep = useAppStore((s) => s.toggleRoutineStep);
  const removeRoutineStep = useAppStore((s) => s.removeRoutineStep);
  const today = new Date().toISOString().slice(0, 10);
  const log = logs.find((item) => item.date === today && item.timeOfDay === time);
  const streak = currentStreak(logs, allSteps);

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
      </Pressable>
      <Heading size={21}>Today</Heading>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Morning" selected={time === 'am'} onPress={() => setTime('am')} />
        <Chip label="Evening" selected={time === 'pm'} onPress={() => setTime('pm')} />
      </View>
      {steps.length === 0 ? (
        <Caption>
          Add products from a product page. Logging should take seconds — tap a row to check it off.
        </Caption>
      ) : null}
      {steps
        .slice()
        .sort((a, b) => a.stepOrder - b.stepOrder)
        .map((step, index) => {
          const product = getProduct(step.productId);
          const done = log?.completedStepIds.includes(step.id) ?? false;
          return (
            <Pressable key={step.id} onPress={() => toggleRoutineStep(step.id, time)}>
              <Card>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Check done={done} />
                  <Thumb emoji={product?.heroEmoji ?? '🧴'} imageUrl={product?.heroImageUrl} size={34} />
                  <View style={{ flex: 1 }}>
                    <Title>{product?.name ?? 'Product'}</Title>
                    <Caption>{`Step ${index + 1}`}</Caption>
                  </View>
                  <Pressable onPress={() => removeRoutineStep(step.id)} hitSlop={8}>
                    <Text style={{ color: colors.inkSoft, fontFamily: fonts.medium }}>Remove</Text>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          );
        })}
      <Button label="+ Add a step from Search" kind="text" onPress={() => router.push('/(tabs)/search')} />
      {streak > 0 ? (
        <Card style={{ backgroundColor: colors.sageSoft, borderColor: colors.sageSoft, alignItems: 'center' }}>
          <Text style={{ fontSize: 21 }}>🌿</Text>
          <Title>{`${streak} ${streak === 1 ? 'day' : 'days'} in a row`}</Title>
          <Caption>Consistency matters more than perfection.</Caption>
        </Card>
      ) : (
        <Caption>Missed a day? Pick up where you left off. The streak stays quiet — no guilt copy.</Caption>
      )}
    </Screen>
  );
}
