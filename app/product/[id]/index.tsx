import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { MasonryFeed, ThreadRow } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { OfficialEmbed } from '@/components/VideoEmbed';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Disclaimer,
  Eyebrow,
  Heading,
  ScoreMeter,
  ScoreRing,
  SectionHeader,
  Title,
} from '@/components/ui';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle,
  Flask,
  Handbag,
  Heart,
  Lightbulb,
  NotePencil,
  Play,
  Plus,
  Scales,
  Storefront,
  TrendUp,
  User,
  Warning,
  YoutubeLogo,
  TiktokLogo,
  InstagramLogo,
  FacebookLogo,
  PinterestLogo,
} from '@/components/icons';
import { colors, elevation, radii, type } from '@/constants/theme';
import { track } from '@/lib/analytics';
import {
  getFeedPosts,
  getLiteracyForProduct,
  getProductPosts,
  getProductThreads,
  routeId,
  tagLabel,
  trackingCount,
} from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { isVerifiedForProduct, useAppStore } from '@/lib/store';
import { FALLBACK_TAGS, PAGE_SIZE, loadTaxonomy, type ContentTagKey } from '@/lib/taxonomy';
import { useProduct } from '@/lib/useProduct';
import { loadJourneyForTag, platformLabel, voterKeyFor } from '@/lib/videos';

const PLATFORM_ICONS = {
  youtube: YoutubeLogo,
  tiktok: TiktokLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  pinterest: PinterestLogo,
} as const;

const TAG_ICONS = {
  how_it_works: Lightbulb,
  how_to_use: BookOpen,
  composition: Flask,
  who_its_for: User,
  results_over_time: TrendUp,
  precautions: Warning,
  comparisons: Scales,
} as const;

/**
 * 04 — Product detail.
 *
 * Clarity journey (HTML order): hero → brand/name → score with reasoning →
 * what's in it → disclaimer → video journey → community masonry → named
 * threads → sticky Get This / satchel. Each section makes the next worth
 * opening — never a document dump.
 */
export default function ProductDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const userThreads = useAppStore((s) => s.userThreads);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addToSatchel = useAppStore((s) => s.addToSatchel);
  const satchelItems = useAppStore((s) => s.satchelItems);
  const markPurchased = useAppStore((s) => s.markPurchased);
  const ownerships = useAppStore((s) => s.ownerships);
  const addRoutineStep = useAppStore((s) => s.addRoutineStep);
  const [journey, setJourney] = useState<ContentTagKey>('who_its_for');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const voterKey = voterKeyFor(profile?.id);

  const taxonomyQuery = useQuery({
    queryKey: ['skincare-taxonomy'],
    queryFn: () => loadTaxonomy(),
    staleTime: 60 * 60 * 1000,
  });
  const tags = taxonomyQuery.data?.length ? taxonomyQuery.data : FALLBACK_TAGS;

  const journeyQuery = useQuery({
    queryKey: ['journey-videos', product?.id, journey],
    queryFn: () => loadJourneyForTag(product!, journey),
    enabled: Boolean(product),
    staleTime: 10 * 60 * 1000,
  });
  const clips = journeyQuery.data?.clips ?? [];
  const videosLoading = journeyQuery.isFetching;
  const fillingGap = journeyQuery.isFetching && (journeyQuery.data?.clips.length ?? 0) < PAGE_SIZE;

  useEffect(() => {
    if (product) track('product_viewed', { productId: product.id, source: product.source });
  }, [product]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPlayingId(null);
  }, [journey]);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.rosewood} />
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen>
        <Heading>Product not found</Heading>
        <Button label="Back to search" onPress={() => router.back()} />
      </Screen>
    );
  }

  const posts = getProductPosts(product.id, userPosts);
  const breakdown = computeConfidence(product, profile, posts);
  const literacy = getLiteracyForProduct(product);
  const saved = favorites.some((item) => item.productId === product.id);
  const inSatchel = satchelItems.some((item) => item.productId === product.id);
  const owned = ownerships.some((item) => item.productId === product.id);
  const verified = isVerifiedForProduct(ownerships, product.id);
  const feedPreview = getFeedPosts(product.id, userPosts).slice(0, 4);
  const threads = getProductThreads(product.id, userThreads, userPosts).slice(0, 2);
  const tracked = trackingCount(product.id);
  const shown = clips.slice(0, visibleCount);
  const currentTag = tags.find((tag) => tag.tagKey === journey);

  return (
    <Screen
      padded={false}
      footer={
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <SatchelAddButton
            inSatchel={inSatchel}
            onPress={() => addToSatchel(product.id)}
          />
          <View style={{ flex: 1 }}>
            <Button
              label="Get This Product"
              icon={Storefront}
              onPress={() => router.push(`/product/${product.id}/stores`)}
            />
          </View>
          <Pressable
            onPress={() => toggleFavorite(product.id)}
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.mist,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.white,
            }}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Saved' : 'Save this product'}
          >
            <Heart
              size={22}
              color={saved ? colors.rosewood : colors.ink}
              weight={saved ? 'fill' : 'regular'}
            />
          </Pressable>
        </View>
      }
    >
      {/* Hero — product first, brand/name land below (HTML 04) */}
      <View style={{ height: 220, backgroundColor: colors.mist }}>
        {product.heroImageUrl ? (
          <Image
            source={{ uri: product.heroImageUrl }}
            style={{ width: '100%', height: 220 }}
            resizeMode="cover"
          />
        ) : null}
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={[
            {
              position: 'absolute',
              top: 12,
              left: 16,
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
            },
            elevation.raised,
          ]}
        >
          <ArrowLeft size={18} color={colors.ink} weight="bold" />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 18, paddingBottom: 8 }}>
        <View style={{ gap: 2 }}>
          <Eyebrow>{product.brand}</Eyebrow>
          <Heading size={20}>{product.name}</Heading>
          {tracked > 0 ? (
            <Caption>{`${tracked} ${tracked === 1 ? 'person is' : 'people are'} tracking this`}</Caption>
          ) : null}
        </View>

        {/* Score + reasoning — never a bare number */}
        <Card level="raised" style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <ScoreRing score={breakdown.compositeScore} />
            <View style={{ flex: 1, gap: 4 }}>
              <Title>
                {breakdown.tooFewReviews ? 'Not enough to score yet' : `${breakdown.headline} for you`}
              </Title>
              <Caption>{breakdown.explanation}</Caption>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.mist }} />
          <ScoreMeter breakdown={breakdown} />
          <Caption>
            Built from these three parts and nothing else. No brand or store can change this number.
          </Caption>
        </Card>

        <View style={{ gap: 9 }}>
          <Heading size={type.hMd}>What&apos;s in it</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {product.ingredients.slice(0, 4).map((tag) => (
              <Chip key={tag} label={tagLabel(tag)} />
            ))}
            {product.attributeTags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tagLabel(tag)} />
            ))}
          </View>
          <Body>
            {literacy[0]?.body ??
              product.description ??
              'Ingredient details are still being completed for this product.'}
          </Body>
          {product.source === 'open_beauty_facts' ? (
            <Caption>Ingredients via Open Beauty Facts, an open community database.</Caption>
          ) : null}
        </View>

        <Disclaimer />

        {/* Video journey */}
        <View style={{ gap: 10 }}>
          <Heading size={type.hMd}>Video journey</Heading>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {tags.map((tag) => (
              <Chip
                key={tag.tagKey}
                label={tag.tagLabel}
                icon={TAG_ICONS[tag.tagKey]}
                selected={journey === tag.tagKey}
                onPress={() => setJourney(tag.tagKey)}
              />
            ))}
          </ScrollView>
          {videosLoading && !clips.length ? <Caption>Looking up short reviews…</Caption> : null}
          {fillingGap ? <Caption>Finding reviews for this topic…</Caption> : null}
          {!clips.length && !videosLoading ? (
            <Caption>
              {currentTag
                ? `Nothing tagged as ${currentTag.tagLabel.toLowerCase()} yet.`
                : 'Nothing tagged for this topic yet.'}
            </Caption>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 9, paddingRight: 4 }}
          >
            {shown.map((clip) => {
              const PlatformMark = PLATFORM_ICONS[clip.platform];
              const playing = playingId === clip.id;
              if (playing) {
                return (
                  <View key={clip.id} style={{ width: 280 }}>
                    <OfficialEmbed clip={clip} voterKey={voterKey} />
                  </View>
                );
              }
              return (
                <Pressable
                  key={clip.id}
                  onPress={() => setPlayingId(clip.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${clip.title}`}
                  style={{ width: 112 }}
                >
                  <View
                    style={{
                      width: 112,
                      height: 72,
                      borderRadius: radii.card,
                      overflow: 'hidden',
                      backgroundColor: colors.ink,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {clip.thumbnailUrl ? (
                      <Image
                        source={{ uri: clip.thumbnailUrl }}
                        style={{ position: 'absolute', width: 112, height: 72 }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.92)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play size={13} color={colors.ink} weight="fill" />
                    </View>
                  </View>
                  <TextClamp>{clip.title}</TextClamp>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    <Badge label={platformLabel(clip.platform)} icon={PlatformMark} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {clips.length > visibleCount ? (
            <Button
              label="Show more"
              kind="quiet"
              onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
            />
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader
            title="From the community"
            actionLabel="See all"
            onAction={() => router.push(`/product/${product.id}/feed`)}
          />
          <MasonryFeed
            posts={feedPreview}
            onPressPost={() => router.push(`/product/${product.id}/feed`)}
          />
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader
            title="Discussions"
            actionLabel="+ New thread"
            onAction={() => router.push(`/product/${product.id}/community`)}
          />
          {threads.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} productId={product.id} />
          ))}
        </View>

        <View style={{ gap: 8, paddingBottom: 8 }}>
          <View style={{ height: 1, backgroundColor: colors.mist, marginBottom: 6 }} />
          <Button
            label={
              owned
                ? verified
                  ? 'You can post as a verified owner'
                  : 'Purchase logged — verification pending'
                : 'I already own this'
            }
            kind="quiet"
            icon={CheckCircle}
            onPress={() => markPurchased(product.id)}
          />
          <Button
            label="Add to my routine"
            kind="text"
            icon={Plus}
            onPress={() => {
              markPurchased(product.id);
              addRoutineStep(product.id, 'am');
              router.push('/routine');
            }}
          />
          <Button
            label="Start a private progress journal"
            kind="text"
            icon={NotePencil}
            onPress={() => router.push(`/product/${product.id}/progress`)}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Camera size={12} color={colors.inkSoft} weight="regular" />
            <Caption>Journal entries stay private unless you choose to share one.</Caption>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function TextClamp({ children }: { children: string }) {
  return (
    <Caption color={colors.ink}>
      {children.length > 42 ? `${children.slice(0, 42)}…` : children}
    </Caption>
  );
}

/** Press → confirm: soft scale then settle when adding to Satchel. */
function SatchelAddButton({ inSatchel, onPress }: { inSatchel: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const confirm = () => {
    onPress();
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.88,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, { toValue: 1.08, friction: 4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={confirm}
        style={{
          width: 50,
          height: 50,
          borderRadius: 12,
          backgroundColor: inSatchel ? colors.rosewood : colors.rosewoodSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel={inSatchel ? 'In your Satchel' : 'Add to Satchel'}
      >
        <Handbag
          size={22}
          color={inSatchel ? colors.white : colors.rosewood}
          weight={inSatchel ? 'fill' : 'regular'}
        />
      </Pressable>
    </Animated.View>
  );
}
