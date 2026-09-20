import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
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
  hapticPresence,
  hapticSuccess,
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

const CHAPTER_META = [
  { key: 'verdict' as const, label: 'The verdict' },
  { key: 'fit' as const, label: 'Confidence for you' },
  { key: 'proof' as const, label: 'The proof' },
  { key: 'people' as const, label: 'The people' },
];

/**
 * Case file — V2: one chapter at a time, prog bars, dock CTA.
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
  const [proofSeg, setProofSeg] = useState<'say' | 'watch'>('say');
  const [journey, setJourney] = useState<ContentTagKey>('who_its_for');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [skin, setSkin] = useState<SkinType | null>(
    profile?.skinType && profile.skinType !== 'unknown' ? profile.skinType : null,
  );
  const [hiOn, setHiOn] = useState(false);
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);
  const lastTick = useRef(0);
  const voterKey = voterKeyFor(profile?.id);

  const caseQuery = useQuery({
    queryKey: ['product-case', product?.id],
    queryFn: () => loadProductCase(product!, userPosts),
    enabled: Boolean(product),
    staleTime: 30 * 60 * 1000,
  });
  const analysis = caseQuery.data;
  const thin = Boolean(analysis && (analysis.tooFew || analysis.productScore == null));

  const activeChapters = useMemo(
    () => (thin && analysis && !caseQuery.isLoading ? [CHAPTER_META[0], CHAPTER_META[3]] : CHAPTER_META),
    [thin, analysis, caseQuery.isLoading],
  );

  const taxonomyQuery = useQuery({
    queryKey: ['skincare-taxonomy'],
    queryFn: () => loadTaxonomy(),
    staleTime: 60 * 60 * 1000,
  });
  const tags = taxonomyQuery.data?.length ? taxonomyQuery.data : FALLBACK_TAGS;

  const journeyQuery = useQuery({
    queryKey: ['journey-videos', product?.id, journey],
    queryFn: () => loadJourneyForTag(product!, journey),
    enabled: Boolean(product) && activeChapters[chapter]?.key === 'proof',
    staleTime: 10 * 60 * 1000,
  });
  const clips = (journeyQuery.data?.clips ?? []).slice(0, PAGE_SIZE);

  useEffect(() => {
    if (product) track('product_viewed', { productId: product.id, source: product.source });
  }, [product]);

  useEffect(() => {
    if (!analysis || analysis.productScore == null || activeChapters[chapter]?.key !== 'verdict') {
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
  }, [analysis?.analyzedAt, analysis?.productScore, chapter, activeChapters, scoreAnim]);

  const goChapter = useCallback(
    (next: number, dir = 1) => {
      const clamped = Math.max(0, Math.min(activeChapters.length - 1, next));
      if (clamped === chapter) return;
      hapticChapterTurn();
      slideAnim.setValue(dir > 0 ? 34 : -34);
      setChapter(clamped);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      if (activeChapters[clamped]?.key === 'people') {
        setTimeout(() => hapticPresence(), 380);
        setTimeout(() => hapticSuccess(), 900);
      }
    },
    [activeChapters, chapter, slideAnim],
  );

  const ctaLabel = () => {
    const key = activeChapters[chapter]?.key;
    if (key === 'verdict') return thin ? 'Meet the people' : 'Is it for me?';
    if (key === 'fit') return skin ? 'See the proof' : 'Skip for now';
    if (key === 'proof') return 'Meet the people';
    return 'Where to buy';
  };

  const onCta = () => {
    hapticTap();
    if (activeChapters[chapter]?.key === 'people') {
      router.push(`/product/${id}/stores`);
      return;
    }
    goChapter(chapter + 1, 1);
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
  const split = analysis?.split ?? { positive: 0, mixed: 0, negative: 0 };
  const Icon = categoryIcon(product.category);
  const current = activeChapters[chapter];
  const presenceN = 40 + (product.id.charCodeAt(0) % 80);

  return (
    <Screen
      scroll={false}
      padded={false}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => {
              hapticTap();
              toggleFavorite(product.id);
            }}
            accessibilityLabel="Save to Satchel"
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: saved ? colors.lac2 : colors.line,
              backgroundColor: saved ? colors.lac2 : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Heart size={22} color={saved ? colors.hi : colors.bone} weight={saved ? 'fill' : 'regular'} />
          </Pressable>
          <Pressable
            onPress={onCta}
            style={{
              flex: 1,
              height: 58,
              borderRadius: 18,
              backgroundColor: current?.key === 'people' ? colors.bone : colors.hi,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.wine }}>{ctaLabel()}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingTop: 12 }}>
        <Pressable
          onPress={() => {
            hapticTap();
            if (chapter > 0) goChapter(chapter - 1, -1);
            else router.back();
          }}
          style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.bone} weight="bold" />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 4 }}>
          {activeChapters.map((ch, i) => (
            <Pressable
              key={ch.key}
              onPress={() => goChapter(i, i > chapter ? 1 : -1)}
              style={{ flex: 1, height: 26, justifyContent: 'center' }}
              accessibilityLabel={ch.label}
            >
              <View
                style={{
                  width: '100%',
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i === chapter ? colors.hi : i < chapter ? colors.bone3 : colors.line,
                }}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            hapticTap();
            router.push(`/product/${product.id}/community`);
          }}
          style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Ask about this product"
        >
          <ChatCircle size={22} color={colors.hi} weight="fill" />
        </Pressable>
      </View>

      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 28, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 14, color: colors.bone2, fontWeight: '500', paddingTop: 6 }}>{current?.label}</Text>

          {current?.key === 'verdict' ? (
            <VerdictChapter
              product={product}
              Icon={Icon}
              analysis={analysis}
              thin={thin}
              loading={caseQuery.isLoading}
              displayScore={displayScore}
              hiOn={hiOn}
              split={split}
              presenceN={presenceN}
            />
          ) : null}

          {current?.key === 'fit' ? (
            <ConfidenceChapter
              skin={skin}
              setSkin={setSkin}
              fit={fit}
              onQuiz={() => router.push('/(onboarding)/quiz')}
            />
          ) : null}

          {current?.key === 'proof' ? (
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
              proofSeg={proofSeg}
              setProofSeg={setProofSeg}
            />
          ) : null}

          {current?.key === 'people' ? (
            <PeopleChapter
              productId={product.id}
              threads={threads}
              ownerCount={analysis?.counts.own ?? 0}
              onSeeAll={() => router.push(`/product/${product.id}/community`)}
            />
          ) : null}
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}

function VerdictChapter({
  product,
  Icon,
  analysis,
  thin,
  loading,
  displayScore,
  hiOn,
  split,
  presenceN,
}: {
  product: Product;
  Icon: ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' }>;
  analysis?: ProductCaseAnalysis;
  thin: boolean;
  loading: boolean;
  displayScore: number;
  hiOn: boolean;
  split: { positive: number; mixed: number; negative: number };
  presenceN: number;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>{product.brand}</Text>
          <Heading size={31} style={{ marginTop: 4 }}>
            {product.name}
          </Heading>
        </View>
        {product.heroImageUrl ? (
          <Image
            source={{ uri: product.heroImageUrl }}
            style={{ width: 54, height: 80, borderRadius: 12, backgroundColor: colors.lac }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 54,
              height: 80,
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

      {loading ? (
        <ActivityIndicator color={colors.hi} style={{ marginTop: 40 }} />
      ) : thin ? (
        <View style={{ marginTop: 26 }}>
          <Heading size={36}>Not enough to score yet.</Heading>
          <Caption color={colors.bone2}>
            {analysis?.basis ?? 'We found too few comments. A score from that would mislead you.'}
          </Caption>
        </View>
      ) : (
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
            <Text
              style={{
                fontFamily: fonts.serif,
                fontWeight: '500',
                fontSize: 120,
                lineHeight: 94,
                letterSpacing: -5,
                color: colors.bone,
                minWidth: 100,
              }}
            >
              {displayScore}
            </Text>
            <View style={{ paddingBottom: 6, flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.bone }}>Product Score</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, marginTop: 2, lineHeight: 20 }}>
                Out of 100. What everyone says.
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
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 16 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sage }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
              Sample · {presenceN} people are reading this right now
            </Text>
          </View>
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
    <View style={{ marginTop: 8 }}>
      <Heading size={36}>Is it right for your skin?</Heading>
      <Caption color={colors.bone2}>Pick your skin type. We’ll check it against people like you.</Caption>
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
        <View style={{ marginTop: 22, paddingTop: 22, borderTopWidth: 1, borderTopColor: colors.line }}>
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
      <Pressable onPress={onQuiz} style={{ marginTop: 14 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone2, textDecorationLine: 'underline' }}>
          Not sure? Take the 3-question quiz
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
  proofSeg,
  setProofSeg,
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
  proofSeg: 'say' | 'watch';
  setProofSeg: (s: 'say' | 'watch') => void;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(
          [
            ['say', 'They say'],
            ['watch', 'Watch'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => {
              hapticTap();
              setProofSeg(k);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: proofSeg === k ? colors.bone : colors.line,
              backgroundColor: proofSeg === k ? colors.bone : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 14,
                color: proofSeg === k ? colors.wine : colors.bone2,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {proofSeg === 'say' ? (
        <View style={{ marginTop: 14 }}>
          <Caption color={colors.bone2}>Share of comments that mention each theme.</Caption>
          {analysis?.clusters?.length ? (
            analysis.clusters.map((cl) => (
              <View
                key={cl.title}
                style={{
                  marginTop: 12,
                  backgroundColor: colors.lac,
                  borderRadius: 26,
                  padding: 22,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 64,
                    lineHeight: 58,
                    color: cl.tone === 'sage' ? colors.sage : cl.tone === 'coral' ? colors.coral : colors.honey,
                    fontWeight: '500',
                  }}
                >
                  {cl.percent}%
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 23,
                    marginTop: 10,
                    color: colors.bone,
                    fontWeight: '500',
                  }}
                >
                  {cl.title}
                </Text>
                <Caption>{cl.who}</Caption>
                {cl.quotes.slice(0, 2).map((q, qi) => (
                  <Text
                    key={qi}
                    style={{ marginTop: 10, fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 24, color: colors.bone }}
                  >
                    “
                    {renderMarkedText(q.text, q.mark ? [q.mark] : []).map((part, pi) =>
                      part.marked ? (
                        <Text key={pi} style={{ backgroundColor: colors.hi, color: colors.wine }}>
                          {part.text}
                        </Text>
                      ) : (
                        <Text key={pi}>{part.text}</Text>
                      ),
                    )}
                    ”
                  </Text>
                ))}
              </View>
            ))
          ) : (
            <Caption color={colors.bone2}>Themes appear once we have enough lived comments.</Caption>
          )}

          <View style={{ marginTop: 28 }}>
            <Heading size={27}>What’s in it</Heading>
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
            <View style={{ marginTop: 12 }}>
              <Disclaimer />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
              <Pressable
                key={clip.id}
                onPress={() => {
                  hapticTap();
                  setPlayingId(clip.id);
                }}
                style={{ width: 280 }}
              >
                {playingId === clip.id ? (
                  <OfficialEmbed clip={clip} voterKey={voterKey} />
                ) : (
                  <>
                    <View
                      style={{
                        height: 172,
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
                      style={{
                        marginTop: 14,
                        fontFamily: fonts.serif,
                        fontSize: 20,
                        lineHeight: 24,
                        color: colors.bone,
                        fontWeight: '500',
                      }}
                    >
                      {clip.title}
                    </Text>
                  </>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function PeopleChapter({
  productId,
  threads,
  ownerCount,
  onSeeAll,
}: {
  productId: string;
  threads: ReturnType<typeof getProductThreads>;
  ownerCount: number;
  onSeeAll: () => void;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <Heading size={36}>You’re not the first to wonder.</Heading>
      <Caption color={colors.bone2}>
        {ownerCount
          ? `${ownerCount} verified owners can answer.`
          : 'No owner experiences yet. Be the first person to leave something behind.'}
      </Caption>

      <Pressable
        onPress={onSeeAll}
        style={{
          marginTop: 18,
          height: 58,
          borderRadius: 18,
          backgroundColor: colors.lac,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
        }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.bone }}>What’s on your mind?</Text>
        <Text style={{ color: colors.bone3, fontSize: 18 }}>→</Text>
      </Pressable>

      <View style={{ marginTop: 20 }}>
        <SectionHeader title="Conversations" actionLabel="See all" onAction={onSeeAll} />
        {threads.length ? (
          threads.map((thread) => <ThreadRow key={thread.id} thread={thread} productId={productId} />)
        ) : (
          <Caption color={colors.bone2}>No threads yet.</Caption>
        )}
      </View>

      <Text style={{ marginTop: 20, fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
        You don’t have to buy it just because you found it.
      </Text>
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
