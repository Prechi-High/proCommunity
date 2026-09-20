import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { ThreadRow } from '@/components/CommunityBits';
import { Screen } from '@/components/Screen';
import { OfficialEmbed } from '@/components/VideoEmbed';
import { Caption, Chip, Disclaimer, Heading, SectionHeader } from '@/components/ui';
import { ArrowLeft, ChatCircle, Heart, Play, categoryIcon } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { track } from '@/lib/analytics';
import {
  getLiteracyForProduct,
  getProductThreads,
  routeId,
  tagLabel,
} from '@/lib/catalog';
import {
  hapticChapterTurn,
  hapticMarked,
  hapticTap,
  hapticVerdictLand,
  hapticVerdictTick,
} from '@/lib/haptics';
import {
  computeFitScore,
  loadProductCase,
  renderMarkedText,
  type ProductCaseAnalysis,
} from '@/lib/productCase';
import { useAppStore } from '@/lib/store';
import { FALLBACK_TAGS, PAGE_SIZE, loadTaxonomy, type ContentTagKey } from '@/lib/taxonomy';
import type { Product, Profile, SkinType } from '@/lib/types';
import { useProduct } from '@/lib/useProduct';
import { loadJourneyForTag, voterKeyFor, type JourneyClip } from '@/lib/videos';

const CHAPTERS = ['The verdict', 'Confidence for you', 'The proof', 'The people'] as const;
const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_W = SCREEN_W;

/**
 * Case file — four chapters, one at a time.
 * Product Score (everyone) vs Confidence for you (skin).
 */
export default function ProductCaseScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const userThreads = useAppStore((s) => s.userThreads);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const [chapter, setChapter] = useState(0);
  const [journey, setJourney] = useState<ContentTagKey>('who_its_for');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [skin, setSkin] = useState<SkinType | null>(
    profile?.skinType && profile.skinType !== 'unknown' ? profile.skinType : null,
  );
  const [hiOn, setHiOn] = useState(false);
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);
  const pagerRef = useRef<ScrollView>(null);
  const lastTick = useRef(0);
  const voterKey = voterKeyFor(profile?.id);

  const caseQuery = useQuery({
    queryKey: ['product-case', product?.id],
    queryFn: () => loadProductCase(product!, userPosts),
    enabled: Boolean(product),
    staleTime: 30 * 60 * 1000,
  });
  const analysis = caseQuery.data;

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
  const clips = (journeyQuery.data?.clips ?? []).slice(0, PAGE_SIZE);

  useEffect(() => {
    if (product) track('product_viewed', { productId: product.id, source: product.source });
  }, [product]);

  useEffect(() => {
    if (!analysis || analysis.productScore == null || chapter !== 0) {
      if (analysis?.productScore == null) {
        setDisplayScore(0);
        setHiOn(false);
      }
      return;
    }
    scoreAnim.setValue(0);
    setHiOn(false);
    lastTick.current = 0;
    const idAnim = scoreAnim.addListener(({ value }) => {
      const n = Math.round(value);
      setDisplayScore(n);
      if (n !== lastTick.current && n % 8 === 0) {
        lastTick.current = n;
        hapticVerdictTick();
      }
    });
    Animated.timing(scoreAnim, {
      toValue: analysis.productScore,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setHiOn(true);
      hapticVerdictLand();
      hapticMarked();
    });
    return () => scoreAnim.removeListener(idAnim);
  }, [analysis?.analyzedAt, analysis?.productScore, chapter, scoreAnim]);

  const goChapter = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(CHAPTERS.length - 1, next));
      if (clamped === chapter) return;
      hapticChapterTurn();
      setChapter(clamped);
      pagerRef.current?.scrollTo({ x: clamped * PAGE_W, animated: true });
    },
    [chapter],
  );

  const onPagerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
    if (idx !== chapter && idx >= 0 && idx < CHAPTERS.length) {
      hapticChapterTurn();
      setChapter(idx);
    }
  };

  if (isLoading || !product) {
    return (
      <Screen>
        {isLoading ? <ActivityIndicator color={colors.hi} /> : <Heading>Product not found</Heading>}
      </Screen>
    );
  }

  const literacy = getLiteracyForProduct(product);
  const saved = favorites.some((item) => item.productId === product.id);
  const threads = getProductThreads(product.id, userThreads, userPosts).slice(0, 2);
  const fitProfile: Profile | null = skin
    ? {
        id: profile?.id ?? 'guest',
        email: profile?.email ?? '',
        displayName: profile?.displayName ?? 'Guest',
        skinType: skin,
        skinTypeSource: profile?.skinTypeSource ?? 'self_selected',
        concerns: profile?.concerns ?? [],
        onboardingComplete: profile?.onboardingComplete ?? false,
      }
    : profile;
  const fit = computeFitScore(product, fitProfile);
  const thin = analysis?.tooFew || analysis?.productScore == null;
  const split = analysis?.split ?? { positive: 0, mixed: 0, negative: 0 };
  const Icon = categoryIcon(product.category);

  return (
    <Screen
      scroll={false}
      padded={false}
      footer={
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {CHAPTERS.map((_, i) => (
                <Pressable key={CHAPTERS[i]} onPress={() => goChapter(i)} hitSlop={6}>
                  <View
                    style={{
                      width: i === chapter ? 18 : 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: i === chapter ? colors.bone : colors.line,
                    }}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone3 }}>
              {chapter + 1} of {CHAPTERS.length} · {CHAPTERS[chapter]}
            </Text>
            {chapter < CHAPTERS.length - 1 ? (
              <Pressable onPress={() => goChapter(chapter + 1)} hitSlop={8}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>Continue</Text>
              </Pressable>
            ) : (
              <View style={{ width: 72 }} />
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => {
                hapticTap();
                router.push(`/product/${product.id}/community`);
              }}
              style={{
                flex: 1,
                height: 54,
                borderRadius: 16,
                backgroundColor: colors.lac,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                gap: 10,
              }}
            >
              <ChatCircle size={18} color={colors.hi} weight="fill" />
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.bone2 }}
              >
                Ask about this product
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                hapticTap();
                router.push(`/product/${product.id}/stores`);
              }}
              style={{
                height: 54,
                paddingHorizontal: 18,
                borderRadius: 16,
                backgroundColor: colors.bone,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.wine }}>Where to buy</Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingTop: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.bone} weight="bold" />
        </Pressable>
        <Pressable
          onPress={() => {
            hapticTap();
            toggleFavorite(product.id);
          }}
          style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <Heart size={22} color={saved ? colors.hi : colors.bone} weight={saved ? 'fill' : 'regular'} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>{product.brand}</Text>
            <Heading size={28} style={{ marginTop: 4 }}>
              {product.name}
            </Heading>
          </View>
          {product.heroImageUrl ? (
            <Image
              source={{ uri: product.heroImageUrl }}
              style={{ width: 48, height: 70, borderRadius: 12, backgroundColor: colors.lac }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 48,
                height: 70,
                borderRadius: 12,
                backgroundColor: colors.lac2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={22} color={colors.bone2} weight="regular" />
            </View>
          )}
        </View>
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScrollEnd}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <ChapterPage>
          <VerdictChapter
            analysis={analysis}
            thin={thin}
            loading={caseQuery.isLoading}
            fetching={caseQuery.isFetching}
            displayScore={displayScore}
            hiOn={hiOn}
            split={split}
          />
        </ChapterPage>
        <ChapterPage>
          <ConfidenceChapter
            skin={skin}
            setSkin={setSkin}
            fit={fit}
            onQuiz={() => router.push('/(onboarding)/quiz')}
          />
        </ChapterPage>
        <ChapterPage>
          <ProofChapter
            product={product}
            analysis={analysis}
            literacy={literacy}
            tags={tags}
            journey={journey}
            setJourney={setJourney}
            clips={clips}
            playingId={playingId}
            setPlayingId={setPlayingId}
            voterKey={voterKey}
          />
        </ChapterPage>
        <ChapterPage>
          <PeopleChapter
            productId={product.id}
            threads={threads}
            onSeeAll={() => router.push(`/product/${product.id}/community`)}
          />
        </ChapterPage>
      </ScrollView>
    </Screen>
  );
}

function ChapterPage({ children }: { children: ReactNode }) {
  return (
    <View style={{ width: PAGE_W }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 28, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

function VerdictChapter({
  analysis,
  thin,
  loading,
  fetching,
  displayScore,
  hiOn,
  split,
}: {
  analysis?: ProductCaseAnalysis;
  thin: boolean;
  loading: boolean;
  fetching: boolean;
  displayScore: number;
  hiOn: boolean;
  split: { positive: number; mixed: number; negative: number };
}) {
  return (
    <View>
      <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <LivePill
          label={
            fetching
              ? 'Reading comments…'
              : `${(analysis?.counts.yt ?? 0) + (analysis?.counts.own ?? 0)} comments in this case`
          }
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.hi} style={{ marginTop: 40 }} />
      ) : thin ? (
        <View style={{ marginTop: 28 }}>
          <Heading size={30}>Not enough to score yet.</Heading>
          <Caption color={colors.bone2}>
            {analysis?.basis ??
              'We need more lived comments from YouTube and owners before a Product Score.'}
          </Caption>
        </View>
      ) : (
        <View style={{ marginTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
            <Text
              style={{
                fontFamily: fonts.serif,
                fontWeight: '500',
                fontSize: 100,
                lineHeight: 78,
                letterSpacing: -4,
                color: colors.bone,
                minWidth: 90,
              }}
            >
              {displayScore}
            </Text>
            <View style={{ paddingBottom: 4, flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.bone }}>Product Score</Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 14,
                  color: colors.bone2,
                  marginTop: 2,
                  lineHeight: 20,
                }}
              >
                Out of 100. What everyone who used it said — not Confidence for you.
              </Text>
            </View>
          </View>

          <Text
            style={{
              marginTop: 22,
              fontFamily: fonts.serif,
              fontWeight: '500',
              fontSize: 24,
              lineHeight: 29,
              letterSpacing: -0.3,
              color: colors.bone,
            }}
          >
            {renderMarkedText(analysis?.verdict ?? '', analysis?.verdictMarks ?? []).map((part, i) =>
              part.marked && hiOn ? (
                <Text key={i} style={{ backgroundColor: colors.hi, color: colors.wine }}>
                  {part.text}
                </Text>
              ) : (
                <Text key={i}>{part.text}</Text>
              ),
            )}
          </Text>

          <View style={{ flexDirection: 'row', gap: 3, marginTop: 22, height: 12 }}>
            <View style={{ flex: Math.max(split.positive, 1), borderRadius: 6, backgroundColor: colors.sage }} />
            <View style={{ flex: Math.max(split.mixed, 1), borderRadius: 6, backgroundColor: colors.honey }} />
            <View style={{ flex: Math.max(split.negative, 1), borderRadius: 6, backgroundColor: colors.coral }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
            <LegendDot color={colors.sage} label={`Positive ${split.positive}%`} />
            <LegendDot color={colors.honey} label={`Mixed ${split.mixed}%`} />
            <LegendDot color={colors.coral} label={`Negative ${split.negative}%`} />
          </View>

          <Text style={{ marginTop: 16, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.bone2 }}>
            {analysis?.basis}
            {analysis?.source === 'llm'
              ? ' · Scored from real comments.'
              : ' · Scored from comment text while the model is offline.'}
          </Text>
          <Text style={{ marginTop: 8, fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
            Sources: YouTube comments
            {(analysis?.counts.own ?? 0) > 0 ? ', Verified Owner traces' : ''}
            . Reddit coming later.
          </Text>
        </View>
      )}
    </View>
  );
}

function ConfidenceChapter({
  skin,
  setSkin,
  fit,
  onQuiz,
}: {
  skin: SkinType | null;
  setSkin: (s: SkinType) => void;
  fit: { score: number; label: string; why: string };
  onQuiz: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 12,
        backgroundColor: colors.lac,
        borderRadius: 26,
        padding: 22,
      }}
    >
      <Heading size={25}>Is it for you?</Heading>
      <Caption color={colors.bone2}>
        Pick your skin type. Confidence for you is separate from the Product Score.
      </Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {(['oily', 'combination', 'dry', 'sensitive'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              hapticTap();
              setSkin(k);
            }}
            style={{
              width: '47%',
              paddingVertical: 15,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: skin === k ? colors.bone : colors.line,
              backgroundColor: skin === k ? colors.bone : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 15,
                color: skin === k ? colors.wine : colors.bone,
                textTransform: 'capitalize',
              }}
            >
              {k}
            </Text>
          </Pressable>
        ))}
      </View>
      {skin ? (
        <View style={{ marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
            <Text
              style={{
                fontFamily: fonts.serif,
                fontSize: 84,
                lineHeight: 68,
                letterSpacing: -3,
                color: colors.bone,
                fontWeight: '500',
              }}
            >
              {fit.score || '—'}
            </Text>
            <View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.bone }}>{fit.label}</Text>
              <Caption>Confidence for you</Caption>
            </View>
          </View>
          <Text style={{ marginTop: 12, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.bone }}>
            {fit.why}
          </Text>
        </View>
      ) : null}
      <Pressable onPress={onQuiz} style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone2 }}>
          Not sure? Take a 3-question quiz
        </Text>
      </Pressable>
    </View>
  );
}

function ProofChapter({
  product,
  analysis,
  literacy,
  tags,
  journey,
  setJourney,
  clips,
  playingId,
  setPlayingId,
  voterKey,
}: {
  product: Product;
  analysis?: ProductCaseAnalysis;
  literacy: ReturnType<typeof getLiteracyForProduct>;
  tags: typeof FALLBACK_TAGS;
  journey: ContentTagKey;
  setJourney: (k: ContentTagKey) => void;
  clips: JourneyClip[];
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
  voterKey: string;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      {analysis?.clusters?.length ? (
        <View>
          <Heading size={27}>They say</Heading>
          <Caption color={colors.bone2}>Share of comments that mention each theme.</Caption>
          {analysis.clusters.map((cl) => (
            <View key={cl.title} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor:
                      cl.tone === 'sage' ? colors.sage : cl.tone === 'coral' ? colors.coral : colors.honey,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.bone }}>{cl.title}</Text>
                  <Caption>{cl.who}</Caption>
                </View>
                <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.bone, fontWeight: '500' }}>
                  {cl.percent}%
                </Text>
              </View>
              {cl.quotes.slice(0, 2).map((q, qi) => (
                <Text
                  key={qi}
                  style={{
                    marginTop: 10,
                    marginLeft: 22,
                    fontFamily: fonts.regular,
                    fontSize: 16,
                    lineHeight: 24,
                    color: colors.bone,
                  }}
                >
                  {renderMarkedText(q.text, q.mark ? [q.mark] : []).map((part, pi) =>
                    part.marked ? (
                      <Text key={pi} style={{ backgroundColor: colors.hi, color: colors.wine }}>
                        {part.text}
                      </Text>
                    ) : (
                      <Text key={pi}>{part.text}</Text>
                    ),
                  )}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View>
          <Heading size={27}>They say</Heading>
          <Caption color={colors.bone2}>Themes appear once we have enough lived comments.</Caption>
        </View>
      )}

      <View style={{ marginTop: 36 }}>
        <Heading size={27}>What’s in it</Heading>
        <Caption color={colors.bone2}>Plain-language notes on ingredients people mention most.</Caption>
        <View style={{ marginTop: 12 }}>
          {product.ingredients.slice(0, 5).map((tag) => (
            <View
              key={tag}
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 13,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.bone, minWidth: 100 }}>
                {tagLabel(tag)}
              </Text>
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.bone2, lineHeight: 22 }}>
                {literacy.find((l) => l.title.toLowerCase().includes(tag.toLowerCase()))?.body ??
                  'Mentioned in traces for this product.'}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 12 }}>
          <Disclaimer />
        </View>
      </View>

      <View style={{ marginTop: 36 }}>
        <Heading size={27}>Watch</Heading>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
          {tags.slice(0, 5).map((tag) => (
            <Chip
              key={tag.tagKey}
              label={tag.tagLabel}
              selected={journey === tag.tagKey}
              onPress={() => setJourney(tag.tagKey)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 14 }}>
          {clips.map((clip) => (
            <Pressable key={clip.id} onPress={() => setPlayingId(clip.id)} style={{ width: 208 }}>
              {playingId === clip.id ? (
                <OfficialEmbed clip={clip} voterKey={voterKey} />
              ) : (
                <>
                  <View
                    style={{
                      height: 118,
                      borderRadius: 14,
                      backgroundColor: colors.lac2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {clip.thumbnailUrl ? (
                      <Image
                        source={{ uri: clip.thumbnailUrl }}
                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(243,235,226,0.92)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play size={16} color={colors.wine} weight="fill" />
                    </View>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{ marginTop: 9, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.bone }}
                  >
                    {clip.title}
                  </Text>
                </>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function PeopleChapter({
  productId,
  threads,
  onSeeAll,
}: {
  productId: string;
  threads: ReturnType<typeof getProductThreads>;
  onSeeAll: () => void;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <Heading size={27}>What’s on your mind?</Heading>
      <Caption color={colors.bone2}>Ask owners. Leave a Trace when you’ve used it.</Caption>

      <View
        style={{
          marginTop: 18,
          backgroundColor: colors.lac,
          borderRadius: 20,
          padding: 18,
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>Live with an expert</Text>
        <Caption color={colors.bone2}>
          No session scheduled for this product yet. When one is, it’ll show here — not a fake room.
        </Caption>
      </View>

      <View style={{ marginTop: 28 }}>
        <SectionHeader title="Conversations" actionLabel="See all" onAction={onSeeAll} />
        {threads.length ? (
          threads.map((thread) => <ThreadRow key={thread.id} thread={thread} productId={productId} />)
        ) : (
          <Caption color={colors.bone2}>No threads yet. Be the first to ask.</Caption>
        )}
      </View>
    </View>
  );
}

function LivePill({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        backgroundColor: 'rgba(243,235,226,0.07)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.bone2 }}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>{label}</Text>
    </View>
  );
}
