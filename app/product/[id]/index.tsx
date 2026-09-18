import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { colors, elevation, scrimGradient } from '@/constants/theme';
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
 * Read top to bottom this should go "I don't know anything about this" ->
 * "I understand this and trust what I'm seeing", one section at a time. The
 * Confidence Score therefore never appears as a bare number: its three parts
 * and their reasoning sit right underneath it, always open. Below that, the
 * video journey and the photo feed each open a genuine curiosity gap that the
 * next section actually pays off.
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
  const [journey, setJourney] = useState<ContentTagKey>('how_to_use');
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
          <Pressable
            onPress={() => addToSatchel(product.id)}
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
          <View style={{ flex: 1 }}>
            <Button
              label="See where to buy"
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
      {/* Full-bleed product photography. Name and brand ride on the image so the
          first thing the eye lands on is the thing itself. */}
      <View style={{ height: 300 }}>
        {product.heroImageUrl ? (
          <Image
            source={{ uri: product.heroImageUrl }}
            style={{ width: '100%', height: 300 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', height: 300, backgroundColor: colors.mist }} />
        )}
        <LinearGradient
          colors={scrimGradient.strong}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 168 }}
        />
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

        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 4 }}>
          <Eyebrow color="#ffffffcc">{product.brand}</Eyebrow>
          <Heading size={24} color={colors.white}>
            {product.name}
          </Heading>
          {tracked > 0 ? (
            <Caption color="#ffffffcc">{`${tracked} ${tracked === 1 ? 'person is' : 'people are'} tracking this`}</Caption>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 22 }}>
        {/* The score, with its reasoning. Never one without the other. */}
        <Card level="raised" style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <ScoreRing score={breakdown.compositeScore} />
            <View style={{ flex: 1, gap: 4 }}>
              <Eyebrow>Confidence score</Eyebrow>
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

        <View style={{ gap: 10 }}>
          <SectionHeader title="What's actually in it" />
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

        {/* Curiosity gap, opened honestly: real reviews, organised by the question
            someone is actually asking at this point. */}
        <View style={{ gap: 10 }}>
          <SectionHeader
            title="Watch someone else's weeks"
            hint="Real reviews, grouped by what you're trying to find out."
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((tag) => (
              <Chip
                key={tag.tagKey}
                label={tag.tagLabel}
                icon={TAG_ICONS[tag.tagKey]}
                selected={journey === tag.tagKey}
                onPress={() => setJourney(tag.tagKey)}
              />
            ))}
          </View>
          {videosLoading && !clips.length ? <Caption>Looking up short reviews…</Caption> : null}
          {fillingGap ? <Caption>Finding reviews for this topic…</Caption> : null}
          {!clips.length && !videosLoading ? (
            <Caption>
              {currentTag
                ? `Nothing tagged as ${currentTag.tagLabel.toLowerCase()} yet.`
                : 'Nothing tagged for this topic yet.'}
            </Caption>
          ) : null}
          {shown.map((clip) => {
            const PlatformMark = PLATFORM_ICONS[clip.platform];
            const playing = playingId === clip.id;
            return (
              <View key={clip.id}>
                {playing ? (
                  <OfficialEmbed clip={clip} voterKey={voterKey} />
                ) : (
                  <Pressable
                    onPress={() => setPlayingId(clip.id)}
                  >
                    <Card style={{ padding: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <View
                          style={{
                            width: 96,
                            height: 62,
                            borderRadius: 10,
                            overflow: 'hidden',
                            backgroundColor: colors.mist,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {clip.thumbnailUrl ? (
                            <Image
                              source={{ uri: clip.thumbnailUrl }}
                              style={{ width: 96, height: 62 }}
                              resizeMode="cover"
                            />
                          ) : null}
                          <View
                            style={{
                              position: 'absolute',
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
                        <View style={{ flex: 1, gap: 5 }}>
                          <Title>{clip.title}</Title>
                          <Caption>{clip.author || platformLabel(clip.platform)}</Caption>
                          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                            <Badge label={currentTag?.tagLabel ?? 'Review'} />
                            <Badge label={platformLabel(clip.platform)} icon={PlatformMark} />
                          </View>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                )}
              </View>
            );
          })}
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
            title="What it looked like for them"
            hint="Photos from people who used it. The critical ones stay up."
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
            title="Conversations about this"
            hint="Named threads, so you can find your exact question."
            actionLabel="All threads"
            onAction={() => router.push(`/product/${product.id}/community`)}
          />
          {threads.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} productId={product.id} />
          ))}
        </View>

        {/* Quieter than the sticky bar above: these are for people who already own it. */}
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
