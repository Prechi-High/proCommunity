import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { MasonryFeed } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Eyebrow,
  Heading,
  Notice,
  ScoreBadge,
  SectionHeader,
  Thumb,
  Title,
  Wordmark,
} from '@/components/ui';
import {
  ArrowRight,
  CaretRight,
  ChatsCircle,
  MagnifyingGlass,
  MoonStars,
  Play,
  Sun,
} from '@/components/icons';
import { colors, elevation, fonts, radii, type } from '@/constants/theme';
import { getAuthor, getFeedPosts, getProduct, getProductPosts, trackingCount } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { searchCatalog } from '@/lib/products';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { currentStreak, useAppStore } from '@/lib/store';
import { daysUntil, withUsageDates } from '@/lib/usage';
import { useProducts } from '@/lib/useProduct';

/**
 * 02 / 02b — Your Shelf.
 *
 * Interleaved: routine, alerts, community, products woven together — not a
 * dashboard of stacked sections. Returning users get quiet competence from a
 * real unfinished routine; new users walk into a room that already feels busy.
 * Streak is stated, never defended — no loss framing.
 */
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

  const evening = new Date().getHours() >= 17;
  const timeOfDay: 'am' | 'pm' = evening ? 'pm' : 'am';
  const activeSteps = steps.filter((step) => step.timeOfDay === timeOfDay);
  const today = new Date().toISOString().slice(0, 10);
  const log = logs.find((item) => item.date === today && item.timeOfDay === timeOfDay);
  const doneCount = Math.min(log?.completedStepIds.length ?? 0, activeSteps.length);
  const streak = currentStreak(logs, steps);
  const allDone = activeSteps.length > 0 && doneCount === activeSteps.length;

  const trendingTerm =
    profile?.skinType && profile.skinType !== 'unknown'
      ? `${profile.skinType} skin skincare`
      : 'skincare serum moisturizer';
  const { data: trending = [], isLoading: trendingLoading } = useQuery({
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

  const allFeedPosts = getFeedPosts(undefined, userPosts);
  const feedPosts = allFeedPosts.slice(0, 4);
  const communitySnippet = allFeedPosts[0] ?? null;
  const firstOwned = ownedIds.map((id) => getProduct(id)).find(Boolean) ?? trending[0] ?? null;
  const firstOwnedBreakdown = firstOwned
    ? computeConfidence(firstOwned, profile, getProductPosts(firstOwned.id, userPosts))
    : null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark />
        <Pressable
          onPress={() => router.push('/(tabs)/you')}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel="Your account"
        >
          <Avatar name={profile?.displayName} size={34} verified={ownerships.length > 0} />
        </Pressable>
      </View>

      {/* 02 — rosewood routine hero */}
      {hasShelf && activeSteps.length > 0 ? (
        <Pressable
          onPress={() => router.push('/routine')}
          accessibilityRole="link"
          accessibilityLabel={evening ? 'Evening routine' : 'Morning routine'}
        >
          <Card
            level="lifted"
            style={{ backgroundColor: colors.rosewood, borderColor: colors.rosewood, padding: 14 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {evening ? (
                    <MoonStars size={12} color="#ffffffbf" weight="fill" />
                  ) : (
                    <Sun size={12} color="#ffffffbf" weight="fill" />
                  )}
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 11,
                      color: '#ffffffbf',
                      letterSpacing: 0.4,
                    }}
                  >
                    {evening ? 'EVENING ROUTINE' : 'MORNING ROUTINE'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 15,
                    color: colors.white,
                    marginTop: 2,
                  }}
                >
                  {allDone
                    ? 'All done for now'
                    : `${doneCount} of ${activeSteps.length} done`}
                </Text>
              </View>
              {streak > 0 ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.white }}>
                    {streak}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: '#ffffffbf' }}>
                    day streak
                  </Text>
                </View>
              ) : (
                <CaretRight size={14} color="#ffffffbf" weight="bold" />
              )}
            </View>
            <RoutineBars
              steps={activeSteps.map((step) => Boolean(log?.completedStepIds.includes(step.id)))}
            />
          </Card>
        </Pressable>
      ) : null}

      {/* Honey notice — real usage only */}
      {refill ? (
        <Pressable
          onPress={() => router.push(`/product/${refill.product.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`${refill.product.name} is running low`}
        >
          <Notice>{`Running low — your ${refill.product.name.toLowerCase()} should last about ${Math.max(refill.days, 0)} more days.`}</Notice>
        </Pressable>
      ) : null}

      {/* 02b — never blank */}
      {!hasShelf ? <RoomIsBusy postCount={allFeedPosts.length} /> : null}

      {/* Interleave: community voice → product → video tease */}
      {hasShelf && communitySnippet ? (
        <Pressable
          onPress={() => router.push('/feed' as Href)}
          accessibilityRole="link"
          accessibilityLabel="Community post"
        >
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Avatar userId={communitySnippet.userId} name={communitySnippet.authorName} size={34} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <Eyebrow color={colors.sage}>Community</Eyebrow>
                </View>
                <Caption color={colors.ink}>
                  {`"${communitySnippet.body.slice(0, 120)}${communitySnippet.body.length > 120 ? '…' : ''}"`}
                </Caption>
              </View>
            </View>
          </Card>
        </Pressable>
      ) : null}

      {hasShelf && firstOwned && firstOwnedBreakdown ? (
        <Pressable
          onPress={() => router.push(`/product/${firstOwned.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`${firstOwned.name} by ${firstOwned.brand}`}
        >
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Thumb imageUrl={firstOwned.heroImageUrl} category={firstOwned.category} size={52} />
              <View style={{ flex: 1, gap: 6 }}>
                <Title>{firstOwned.name}</Title>
                <ScoreBadge breakdown={firstOwnedBreakdown} />
              </View>
              <CaretRight size={14} color={colors.mist} weight="bold" />
            </View>
          </Card>
        </Pressable>
      ) : null}

      {hasShelf ? (
        <Pressable
          onPress={() =>
            firstOwned
              ? router.push(`/product/${firstOwned.id}`)
              : router.push('/(tabs)/search')
          }
          accessibilityRole="link"
          accessibilityLabel="Open video journey"
        >
          <View
            style={{
              height: 130,
              borderRadius: radii.card,
              backgroundColor: colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Play size={20} color={colors.white} weight="fill" />
            </View>
            <Text
              style={{
                marginTop: 10,
                fontFamily: fonts.medium,
                fontSize: 12,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              Continue a video journey
            </Text>
          </View>
        </Pressable>
      ) : null}

      {trendingLoading || trending.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader
            title={
              profile?.skinType && profile.skinType !== 'unknown'
                ? `Popular with ${SKIN_TYPE_LABEL[profile.skinType].toLowerCase()} skin`
                : 'Being discussed right now'
            }
            hint={hasShelf ? undefined : 'Tap any of these to see what people actually said.'}
          />
          {trendingLoading ? <ProductRowSkeleton count={3} /> : null}
          {trending.slice(0, hasShelf ? 2 : 4).map((product) => {
            const posts = getProductPosts(product.id, userPosts);
            const breakdown = computeConfidence(product, profile, posts);
            const tracked = trackingCount(
              product.id,
              ownedIds.includes(product.id) && profile ? [profile.id] : [],
            );
            return (
              <Pressable
                key={product.id}
                onPress={() => router.push(`/product/${product.id}`)}
                accessibilityRole="link"
                accessibilityLabel={`${product.name} by ${product.brand}`}
              >
                <Card style={{ padding: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Thumb imageUrl={product.heroImageUrl} category={product.category} size={52} />
                    <View style={{ flex: 1, gap: 5 }}>
                      <Title>{product.name}</Title>
                      <Caption>{product.brand}</Caption>
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                      >
                        <ScoreBadge breakdown={breakdown} />
                        {tracked > 0 ? (
                          <Caption>{`${tracked} ${tracked === 1 ? 'person' : 'people'} tracking`}</Caption>
                        ) : null}
                      </View>
                    </View>
                    <CaretRight size={14} color={colors.mist} weight="bold" />
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {feedPosts.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader
            title="From the community"
            actionLabel="See all"
            onAction={() => router.push('/feed' as Href)}
          />
          <MasonryFeed posts={feedPosts} />
        </View>
      ) : null}

      {!hasShelf ? (
        <Button
          label="Find your first product"
          icon={MagnifyingGlass}
          onPress={() => router.push('/(tabs)/search')}
        />
      ) : null}
    </Screen>
  );
}

/** Progress segments fill on appear — quiet competence, not urgency. */
function RoutineBars({ steps }: { steps: boolean[] }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, steps.length]);

  return (
    <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
      {steps.map((done, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 3,
            backgroundColor: 'rgba(255,255,255,0.3)',
            overflow: 'hidden',
          }}
        >
          {done ? (
            <Animated.View
              style={{
                height: 4,
                borderRadius: 3,
                backgroundColor: colors.white,
                width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ProductRowSkeleton({ count }: { count: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} style={{ padding: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: radii.thumb, backgroundColor: colors.mist }} />
            <View style={{ flex: 1, gap: 7 }}>
              <View style={{ height: 11, width: '62%', borderRadius: 6, backgroundColor: colors.mist }} />
              <View style={{ height: 9, width: '38%', borderRadius: 5, backgroundColor: colors.mist }} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function RoomIsBusy({ postCount }: { postCount: number }) {
  const router = useRouter();
  const voices = ['user-amara', 'user-ken', 'user-tola', 'user-zainab']
    .map((id) => getAuthor(id))
    .filter(Boolean);

  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: radii.card,
          borderWidth: 1,
          borderColor: colors.mist,
          padding: 14,
          gap: 12,
        },
        elevation.raised,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {voices.map((author, index) => (
          <Image
            key={author!.id}
            source={{ uri: author!.avatarUrl! }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              marginLeft: index === 0 ? 0 : -9,
              borderWidth: 2,
              borderColor: colors.shell,
              backgroundColor: colors.mist,
            }}
          />
        ))}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ChatsCircle size={13} color={colors.sage} weight="fill" />
            <Eyebrow color={colors.sage}>Already happening</Eyebrow>
          </View>
        </View>
      </View>

      <Heading size={type.hMd}>
        {`${voices.length} members have written ${postCount} posts about what actually happened to their skin`}
      </Heading>
      <Body>You can read all of it before you add anything, tell us anything, or buy anything.</Body>
      <Pressable
        onPress={() => router.push('/feed' as Href)}
        accessibilityRole="link"
        accessibilityLabel="Read the community feed"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.rosewood }}>
          Read the community feed
        </Text>
        <ArrowRight size={13} color={colors.rosewood} weight="bold" />
      </Pressable>
    </View>
  );
}
