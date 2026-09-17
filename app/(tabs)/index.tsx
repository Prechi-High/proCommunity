import { useQuery } from '@tanstack/react-query';
import { Image, Pressable, Text, View } from 'react-native';
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
  Drop,
  Leaf,
  MagnifyingGlass,
  MoonStars,
  Sun,
} from '@/components/icons';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { getAuthor, getFeedPosts, getProduct, getProductPosts, trackingCount } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { searchCatalog } from '@/lib/products';
import { SKIN_TYPE_LABEL } from '@/lib/quiz';
import { currentStreak, useAppStore } from '@/lib/store';
import { daysUntil, withUsageDates } from '@/lib/usage';
import { useProducts } from '@/lib/useProduct';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * 02 / 02b — Your Shelf.
 *
 * Returning: the unfinished routine leads, because genuine incompleteness is
 * what should pull someone back — never guilt. Nothing on this screen uses
 * loss framing.
 *
 * Empty: the community leads instead, so a brand-new user walks into a room
 * where things are already happening rather than an empty waiting area. Every
 * number shown is counted from real posts.
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
  const feedPosts = allFeedPosts.slice(0, 6);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Wordmark />
          <Caption>
            {profile?.displayName ? `${greeting()}, ${profile.displayName}` : greeting()}
          </Caption>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/you')}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel="Your account"
        >
          <Avatar name={profile?.displayName} size={38} verified={ownerships.length > 0} />
        </Pressable>
      </View>

      {/* Returning user: the unfinished routine is the first thing read. */}
      {hasShelf && activeSteps.length > 0 ? (
        <Pressable
          onPress={() => router.push('/routine')}
          accessibilityRole="link"
          accessibilityLabel={evening ? 'Evening routine' : 'Morning routine'}
        >
          <Card
            level="lifted"
            style={{ backgroundColor: colors.rosewood, borderColor: colors.rosewood, padding: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {evening ? (
                <MoonStars size={17} color="#ffffffcc" weight="fill" />
              ) : (
                <Sun size={17} color="#ffffffcc" weight="fill" />
              )}
              <Text
                style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: '#ffffffcc', letterSpacing: 0.9 }}
              >
                {evening ? 'EVENING ROUTINE' : 'MORNING ROUTINE'}
              </Text>
              <View style={{ flex: 1 }} />
              <CaretRight size={14} color="#ffffffcc" weight="bold" />
            </View>

            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 21,
                color: colors.white,
                marginTop: 8,
                letterSpacing: -0.5,
              }}
            >
              {allDone
                ? 'All done for now'
                : doneCount === 0
                  ? `${activeSteps.length} ${activeSteps.length === 1 ? 'step' : 'steps'} whenever you're ready`
                  : `${doneCount} of ${activeSteps.length} done`}
            </Text>

            <View style={{ flexDirection: 'row', gap: 5, marginTop: 14 }}>
              {activeSteps.map((step) => (
                <View
                  key={step.id}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: log?.completedStepIds.includes(step.id)
                      ? colors.white
                      : 'rgba(255,255,255,0.28)',
                  }}
                />
              ))}
            </View>

            {/* Streak is stated, never defended. No loss framing anywhere. */}
            {streak > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Leaf size={13} color="#ffffffcc" weight="fill" />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: '#ffffffcc' }}>
                  {`${streak} ${streak === 1 ? 'day' : 'days'} in a row`}
                </Text>
              </View>
            ) : null}
          </Card>
        </Pressable>
      ) : null}

      {/* A real alert from real usage data — never a manufactured one. */}
      {refill ? (
        <Pressable
          onPress={() => router.push(`/product/${refill.product.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`${refill.product.name} is running low`}
        >
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.honeySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Drop size={18} color={colors.honey} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Title>{`${refill.product.name} is running low`}</Title>
              <Caption>{`About ${Math.max(refill.days, 0)} days left at your usual pace.`}</Caption>
            </View>
            <CaretRight size={14} color={colors.inkSoft} weight="bold" />
          </Card>
        </Pressable>
      ) : null}

      {/* New user: the room is already busy. Counts below are real. */}
      {!hasShelf ? <RoomIsBusy postCount={allFeedPosts.length} /> : null}

      {/* A section header is a promise; never show one over nothing. */}
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
          {trending.slice(0, 4).map((product) => {
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
                    <Thumb imageUrl={product.heroImageUrl} category={product.category} size={58} />
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
            title="What people are posting"
            hint="Newest first. Nothing boosted, nothing hidden."
            actionLabel="See all"
            onAction={() => router.push('/feed' as Href)}
          />
          <MasonryFeed posts={feedPosts} />
        </View>
      ) : (
        <Body>No live discussion yet on your tracked products.</Body>
      )}

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

/** Holds the shape of the list while the catalog answers, so nothing jumps. */
function ProductRowSkeleton({ count }: { count: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} style={{ padding: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: colors.mist }} />
            <View style={{ flex: 1, gap: 7 }}>
              <View style={{ height: 11, width: '62%', borderRadius: 6, backgroundColor: colors.mist }} />
              <View style={{ height: 9, width: '38%', borderRadius: 5, backgroundColor: colors.mist }} />
              <View style={{ height: 16, width: 78, borderRadius: 8, backgroundColor: colors.mist }} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

/**
 * 02b — social proof for someone with nothing on their shelf yet.
 *
 * Real faces and a real count. A small honest number ("11 posts") earns more
 * trust than a vague large claim, and it is the first thing a new user sees.
 */
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
          padding: 16,
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
              width: 38,
              height: 38,
              borderRadius: 19,
              marginLeft: index === 0 ? 0 : -12,
              borderWidth: 2,
              borderColor: colors.white,
              backgroundColor: colors.mist,
            }}
          />
        ))}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ChatsCircle size={13} color={colors.sage} weight="fill" />
            <Eyebrow color={colors.sage}>Already happening</Eyebrow>
          </View>
        </View>
      </View>

      <Heading size={18}>
        {`${voices.length} members have written ${postCount} posts about what actually happened to their skin`}
      </Heading>
      <Body>
        You can read all of it before you add anything, tell us anything, or buy anything.
      </Body>
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
