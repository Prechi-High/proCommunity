import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { MasonryFeed } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Notice,
  ScoreBadge,
  Thumb,
  Title,
  Wordmark,
} from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { getFeedPosts, getProduct, getProductPosts, trackingCount } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { searchCatalog } from '@/lib/products';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { currentStreak, useAppStore } from '@/lib/store';
import { daysUntil, withUsageDates } from '@/lib/usage';
import { useProducts } from '@/lib/useProduct';

export default function ShelfScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const ownerships = useAppStore((s) => s.ownerships);
  const steps = useAppStore((s) => s.routineSteps);
  const logs = useAppStore((s) => s.routineLogs);
  const usage = useAppStore((s) => s.usageEstimates);
  const userPosts = useAppStore((s) => s.userPosts);

  const ownedIds = ownerships.map((item) => item.productId);
  const hasShelf = ownedIds.length > 0 || steps.length > 0;
  const amSteps = steps.filter((step) => step.timeOfDay === 'am');
  const today = new Date().toISOString().slice(0, 10);
  const amLog = logs.find((log) => log.date === today && log.timeOfDay === 'am');
  const doneCount = amLog?.completedStepIds.length ?? 0;
  const streak = currentStreak(logs, steps);

  const trendingTerm =
    profile?.skinType && profile.skinType !== 'unknown'
      ? `${profile.skinType} skin skincare`
      : 'skincare serum moisturizer';
  const { data: trending = [] } = useQuery({
    queryKey: ['shelf-trending', trendingTerm],
    queryFn: () => searchCatalog(trendingTerm),
    staleTime: 10 * 60 * 1000,
  });

  useProducts([...new Set([...ownedIds, ...usage.map((item) => item.productId)])]);

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

  const feedPosts = getFeedPosts(undefined, userPosts).slice(0, 4);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark />
        <Pressable onPress={() => router.push('/(tabs)/you')}>
          <Thumb emoji="🙂" size={34} />
        </Pressable>
      </View>

      {hasShelf && amSteps.length > 0 ? (
        <Pressable onPress={() => router.push('/routine')}>
          <Card style={{ backgroundColor: colors.rosewood, borderColor: colors.rosewood }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#ffffffbf' }}>
                  MORNING ROUTINE
                </Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white, marginTop: 2 }}>
                  {`${Math.min(doneCount, amSteps.length)} of ${amSteps.length} done`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.white }}>{streak}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: '#ffffffbf' }}>day streak</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
              {amSteps.map((step) => (
                <View
                  key={step.id}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 3,
                    backgroundColor: amLog?.completedStepIds.includes(step.id)
                      ? colors.white
                      : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </View>
          </Card>
        </Pressable>
      ) : null}

      {refill ? (
        <Notice>{`You may be running low on ${refill.product.name} — about ${Math.max(refill.days, 0)} days left based on typical use.`}</Notice>
      ) : null}

      {!hasShelf ? (
        <Card style={{ alignItems: 'center', padding: 18 }}>
          <Text style={{ fontSize: 26 }}>🔍</Text>
          <Title>Your shelf is empty</Title>
          <Caption>Search a product to start tracking what you use.</Caption>
          <View style={{ width: '100%', marginTop: 14 }}>
            <Button label="Find a product" onPress={() => router.push('/(tabs)/search')} />
          </View>
        </Card>
      ) : null}

      <Heading size={16}>
        {profile?.skinType && profile.skinType !== 'unknown'
          ? `Popular with ${SKIN_TYPE_LABEL[profile.skinType]} skin`
          : 'Being discussed'}
      </Heading>

      {trending.slice(0, 4).map((product) => {
        const posts = getProductPosts(product.id, userPosts);
        const breakdown = computeConfidence(product, profile, posts);
        const tracked = trackingCount(product.id, ownedIds.includes(product.id) && profile ? [profile.id] : []);
        return (
          <Pressable key={product.id} onPress={() => router.push(`/product/${product.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Thumb emoji={product.heroEmoji} imageUrl={product.heroImageUrl} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Title>{product.name}</Title>
                  <ScoreBadge breakdown={breakdown} />
                  {tracked > 0 ? (
                    <Caption>{`${tracked} ${tracked === 1 ? 'person' : 'people'} tracking this`}</Caption>
                  ) : null}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}

      {feedPosts[0] ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Heading size={16}>From the community</Heading>
            <Pressable onPress={() => router.push('/feed' as Href)}>
              <Caption color={colors.rosewood}>See all</Caption>
            </Pressable>
          </View>
          <MasonryFeed posts={feedPosts} />
        </View>
      ) : (
        <Body>No live discussion yet on your tracked products.</Body>
      )}
    </Screen>
  );
}
