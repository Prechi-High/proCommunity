import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import {
  Avatar,
  Button,
  Caption,
  Card,
  Check,
  Heading,
  Notice,
  Thumb,
  Title,
  Wordmark,
} from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { getProduct, getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { currentStreak, useAppStore } from '@/lib/store';
import { daysUntil, withUsageDates } from '@/lib/usage';
import { useProducts } from '@/lib/useProduct';

/**
 * Shelf tab — routine + saved, wine/bone V1 card language.
 */
export default function ShelfScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const ownerships = useAppStore((s) => s.ownerships);
  const steps = useAppStore((s) => s.routineSteps);
  const logs = useAppStore((s) => s.routineLogs);
  const toggleRoutineStep = useAppStore((s) => s.toggleRoutineStep);
  const favorites = useAppStore((s) => s.favorites);
  const usage = useAppStore((s) => s.usageEstimates);
  const userPosts = useAppStore((s) => s.userPosts);
  const eveningDefault = new Date().getHours() >= 17;
  const [mode, setMode] = useState<'am' | 'pm'>(eveningDefault ? 'pm' : 'am');

  const active = steps.filter((s) => s.timeOfDay === mode);
  const today = new Date().toISOString().slice(0, 10);
  const log = logs.find((item) => item.date === today && item.timeOfDay === mode);
  const doneCount = Math.min(log?.completedStepIds.length ?? 0, active.length);
  const streak = currentStreak(logs, steps);

  useProducts([
    ...ownerships.map((o) => o.productId),
    ...favorites.map((f) => f.productId),
    ...usage.map((u) => u.productId),
  ]);

  const refill = usage
    .map((item) => {
      const product = getProduct(item.productId);
      if (!product?.typicalDurationDays) return null;
      const dated = withUsageDates(item, product);
      const days = daysUntil(dated.estimatedEmptyDate);
      if (days == null || days > 10) return null;
      return { product, days };
    })
    .find(Boolean);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <Wordmark />
        <Pressable onPress={() => router.push('/(tabs)/you')}>
          <Avatar name={profile?.displayName} size={44} />
        </Pressable>
      </View>

      <Heading size={32} style={{ marginTop: 14 }}>
        Your shelf
      </Heading>

      {active.length ? (
        <Card style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Caption>{mode === 'pm' ? 'Evening routine' : 'Morning routine'}</Caption>
              <Text
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 24,
                  color: colors.bone,
                  marginTop: 2,
                  fontWeight: '500',
                }}
              >
                {`${doneCount} of ${active.length} done`}
              </Text>
            </View>
            {streak > 0 ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.bone, fontWeight: '500' }}>
                  {streak}
                </Text>
                <Caption>days in a row</Caption>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 14 }}>
            {active.map((step) => {
              const done = Boolean(log?.completedStepIds.includes(step.id));
              return (
                <View
                  key={step.id}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 3,
                    backgroundColor: done ? colors.sage : 'rgba(243,235,226,0.2)',
                  }}
                />
              );
            })}
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {(['am', 'pm'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: mode === m ? colors.bone : colors.line,
              backgroundColor: mode === m ? colors.bone : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 14,
                color: mode === m ? colors.wine : colors.bone2,
              }}
            >
              {m === 'am' ? 'Morning' : 'Evening'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: 10 }}>
        {active.map((step, index) => {
          const product = getProduct(step.productId);
          const done = Boolean(log?.completedStepIds.includes(step.id));
          return (
            <Pressable
              key={step.id}
              onPress={() => toggleRoutineStep(step.id, mode)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              <Check done={done} />
              <View style={{ flex: 1 }}>
                <Title>{product?.name ?? 'Step'}</Title>
                <Caption>{`Step ${index + 1}`}</Caption>
              </View>
            </Pressable>
          );
        })}
      </View>

      {active.length ? (
        <Caption>Miss a day and you simply pick up where you left off.</Caption>
      ) : (
        <View style={{ marginTop: 12, gap: 12 }}>
          <Caption color={colors.bone2}>No routine yet. Add products from a case file.</Caption>
          <Button label="Find a product" onPress={() => router.push('/(tabs)')} />
        </View>
      )}

      {refill ? (
        <View style={{ marginTop: 20 }}>
          <Notice>{`Running low: your ${refill.product.name.toLowerCase()} should last about ${Math.max(refill.days, 0)} more days.`}</Notice>
        </View>
      ) : null}

      <Heading size={23} style={{ marginTop: 34 }}>
        Saved
      </Heading>
      {favorites.length ? (
        favorites.map((fav) => {
          const product = getProduct(fav.productId);
          if (!product) return null;
          const score = computeConfidence(product, profile, getProductPosts(product.id, userPosts))
            .compositeScore;
          return (
            <Pressable
              key={fav.productId}
              onPress={() => router.push(`/product/${product.id}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              <Thumb imageUrl={product.heroImageUrl} category={product.category} size={48} />
              <View style={{ flex: 1 }}>
                <Title>{product.name}</Title>
                <Caption>{score == null ? 'No score yet' : `Verdict ${score}`}</Caption>
              </View>
            </Pressable>
          );
        })
      ) : (
        <Caption color={colors.bone2}>
          Tap the bookmark on any case to collect it here while you keep researching.
        </Caption>
      )}

      {favorites.length ? (
        <Button
          label="Ready to buy"
          kind="hl"
          style={{ marginTop: 14 }}
          onPress={() => router.push(`/product/${favorites[0].productId}/stores`)}
        />
      ) : null}

      <Pressable onPress={() => router.push('/feed' as Href)} style={{ marginTop: 28 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone2 }}>
          Browse community →
        </Text>
      </Pressable>
    </Screen>
  );
}
