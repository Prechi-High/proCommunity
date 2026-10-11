import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import {
  ArrowsLeftRight,
  Bell,
  CaretRight,
  ChatsCircle,
  Check,
  DeviceMobile,
  Fire,
  Flower,
  House,
  Lightbulb,
  MagnifyingGlass,
  Scan,
  TShirt,
} from '@/components/icons';
import { ProductImage, SearchBar, Shimmer } from '@/components/kit';
import { PulseConversationCard } from '@/components/pulse/PulseConversationCard';
import { brandAssets } from '@/constants/brand';
import { SEARCH_CATEGORY_IMAGE_URLS, SEARCH_HOME_CATEGORIES, searchHomeHero } from '@/constants/searchHome';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { fetchPulse, timeAgo } from '@/lib/community';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { rememberProduct } from '@/lib/products';
import { buildMixedTrendingFeed } from '@/lib/searchHomeTrending';
import { useAppStore } from '@/lib/store';
import type { CommunityThread, TrendingProduct } from '@/lib/types';
import { useScan } from '@/lib/useScan';

const PINK = ['#FDF2F4', '#F8E4E9', '#FDF2F4'] as const;
const PINK_BANNER = '#F9E8EC';
const BLUE_BANNER = '#E8F0FA';

const SCREEN_PAD_H = 8;
const CATEGORY_COLS = 4;
const TRENDING_VISIBLE = 5;
const CONVO_HOME_VISIBLE = 3;

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StepMiniIcons() {
  const items = [
    { Icon: DeviceMobile, bg: '#E8F4FF' },
    { Icon: Flower, bg: '#FCE8F0' },
    { Icon: House, bg: '#FFF4E5' },
    { Icon: TShirt, bg: '#EDE8FF' },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
      {items.map(({ Icon, bg }, i) => (
        <View key={i} style={{ width: 36, height: 30, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={colors.bone} weight="bold" />
        </View>
      ))}
    </View>
  );
}

export function SearchHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catGap = 8;
  const categoryWidth = (width - SCREEN_PAD_H * 2 - catGap * (CATEGORY_COLS - 1)) / CATEGORY_COLS;
  const trendGap = 8;
  const trendingWidth = (width - SCREEN_PAD_H * 2 - trendGap * (TRENDING_VISIBLE - 1)) / TRENDING_VISIBLE;
  const convoGap = 8;
  const convoCardW = (width - SCREEN_PAD_H * 2 - convoGap * (CONVO_HOME_VISIBLE - 1)) / CONVO_HOME_VISIBLE;
  const stepGap = 6;
  const stepInnerW = width - SCREEN_PAD_H * 2;
  const stepCardW = (stepInnerW - stepGap * 2) / 3;

  const [query, setQuery] = useState('');
  const [stickySearch, setStickySearch] = useState(false);
  const scrollY = useRef(0);
  const stickyOpacity = useRef(new Animated.Value(0)).current;
  const scan = useScan();
  const selectedCategories = useAppStore((s) => s.searchCategoryIds);
  const toggleCategory = useAppStore((s) => s.toggleSearchCategory);

  const pulse = useQuery({ queryKey: ['pulse'], queryFn: () => fetchPulse(), staleTime: 60_000 });
  const trendingRaw = pulse.data?.trending ?? [];
  const mixedTrending = useMemo(() => buildMixedTrendingFeed(trendingRaw, 12), [trendingRaw]);
  const compares = (pulse.data?.threads ?? []).filter((t) => t.kind === 'compare').slice(0, 2);
  const allThreads = pulse.data?.threads ?? [];

  const hotConversations = useMemo(() => {
    return [...allThreads]
      .filter((t) => t.kind !== 'compare')
      .sort((a, b) => {
        const scoreA = (a.reply_count ?? 0) + (a.votes ?? 0) * 2;
        const scoreB = (b.reply_count ?? 0) + (b.votes ?? 0) * 2;
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [allThreads]);

  const conversationCards = useMemo(() => {
    return hotConversations.map((thread) => {
      const related = allThreads.filter((th) => th.product_id === thread.product_id);
      const postCount = related.reduce((sum, th) => sum + 1 + (th.reply_count ?? 0), 0) || thread.reply_count + 1;
      const item: TrendingProduct = {
        id: thread.product_id,
        name: thread.product_name,
        brand: thread.brand ?? '',
        category: thread.category ?? '',
        image: thread.product_image,
        views: 0,
        asks: 0,
        threads: postCount,
        compares: 0,
        heat: postCount,
      };
      return { thread, item, title: thread.title, postCount };
    });
  }, [hotConversations, allThreads]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - scrollY.current;
    scrollY.current = y;

    if (dy > 6 && y > 120) {
      if (stickySearch) {
        setStickySearch(false);
        Animated.timing(stickyOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      }
    } else if (dy < -6 && y > 40) {
      if (!stickySearch) {
        setStickySearch(true);
        Animated.timing(stickyOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      }
    } else if (y <= 40) {
      if (stickySearch) {
        setStickySearch(false);
        Animated.timing(stickyOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      }
    }
  };

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    track('product_search_started', { query: trimmed });
    useAppStore.getState().addSearch(trimmed);
    const niche = selectedCategories.length ? selectedCategories.join(',') : undefined;
    router.push({
      pathname: '/results',
      params: niche ? { q: trimmed, niche } : { q: trimmed },
    } as Href);
  };

  const openTrending = (t: TrendingProduct) => {
    rememberProduct({ id: t.id, name: t.name, brand: t.brand, category: t.category, heroImageUrl: t.image });
    router.push({ pathname: '/product/[id]', params: { id: t.id, q: t.name } } as Href);
  };

  const openThread = (id: string) => router.push({ pathname: '/thread/[id]', params: { id } } as Href);

  const stickyTop = insets.top + 8;

  return (
    <Screen>
      <Animated.View
        pointerEvents={stickySearch ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: stickyTop,
          left: SCREEN_PAD_H,
          right: SCREEN_PAD_H,
          zIndex: 20,
          opacity: stickyOpacity,
          transform: [{ translateY: stickyOpacity.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        }}
      >
        <View style={{ backgroundColor: colors.wine, borderRadius: 14, padding: 4, ...elevation.raised }}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={() => go(query)}
            onScan={scan.start}
            busy={scan.busy}
            placeholder="Search products, brands or questions..."
          />
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={{ paddingHorizontal: SCREEN_PAD_H, paddingTop: 12, gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Image source={brandAssets.fullTaglineInk} style={{ height: 52, width: 168, resizeMode: 'contain' }} accessibilityLabel="Unmask" />
            <Pressable
              onPress={() => router.push('/notifications' as Href)}
              hitSlop={12}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}
            >
              <Bell size={22} color={colors.bone} weight="bold" />
              <View style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral }} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 8, paddingTop: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.hi, textTransform: 'uppercase' }}>
                Research. Compare. Unmask.
              </Text>
              <Text style={{ fontFamily: fonts.serifBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: colors.bone }}>
                Unmask what you&apos;re about to buy.
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.bone2 }}>
                Real product facts, real experiences, real people.
              </Text>
            </View>
            <Image
              source={searchHomeHero}
              style={{ width: 148, height: 132, resizeMode: 'contain' }}
              accessibilityLabel="Unmask product insights"
            />
          </View>

          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={() => go(query)}
            onScan={scan.start}
            busy={scan.busy}
            placeholder="Search products, brands or questions..."
          />

          <LinearGradient
            colors={[...PINK]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ marginHorizontal: -SCREEN_PAD_H, paddingVertical: 14, gap: 10 }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone, textAlign: 'center', paddingHorizontal: SCREEN_PAD_H }}>
              3 simple steps to <Text style={{ fontFamily: fonts.serifBold, color: colors.hi }}>unmask</Text> any product
            </Text>
            <View style={{ flexDirection: 'row', gap: stepGap, paddingHorizontal: SCREEN_PAD_H }}>
              <StepCard
                width={stepCardW}
                n={1}
                title="Choose a category"
                body="Get the right template"
                extra={<StepMiniIcons />}
              />
              <StepCard
                width={stepCardW}
                n={2}
                title="Search or snap"
                body="Type or take a photo"
                extra={
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                    <View style={{ flex: 1, height: 32, borderRadius: 8, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
                      <MagnifyingGlass size={16} color={colors.bone3} weight="bold" />
                    </View>
                    <View style={{ flex: 1, height: 32, borderRadius: 8, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
                      <Scan size={16} color={colors.white} weight="bold" />
                    </View>
                  </View>
                }
              />
              <StepCard
                width={stepCardW}
                n={3}
                title="Unmask"
                body="Facts, reviews & more"
                extra={
                  <View style={{ marginTop: 4, height: 36, borderRadius: 8, backgroundColor: colors.lac, borderWidth: 1, borderColor: colors.line, padding: 6, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 9, color: colors.hi }}>Scorecard</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 8, color: colors.bone3 }}>Evidence · Ask</Text>
                  </View>
                }
              />
            </View>
          </LinearGradient>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.bone }}>Choose what you want to unmask</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2 }}>Tap to select — stay on this page to search or snap</Text>
              </View>
              <Pressable onPress={() => router.push('/pulse' as Href)} hitSlop={8} style={{ paddingTop: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>See all ›</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: catGap }}>
              {SEARCH_HOME_CATEGORIES.map((cat) => {
                const selected = selectedCategories.includes(cat.id);
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      hapticSelect();
                      toggleCategory(cat.id);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={{
                      width: categoryWidth,
                      backgroundColor: colors.lac,
                      borderRadius: 12,
                      padding: 6,
                      gap: 6,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? colors.hi : colors.line,
                      ...elevation.raised,
                    }}
                  >
                    {selected ? (
                      <View style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                        <Check size={11} color={colors.white} weight="bold" />
                      </View>
                    ) : null}
                    <Image
                      source={{ uri: SEARCH_CATEGORY_IMAGE_URLS[cat.id] }}
                      style={{ width: '100%', height: 52, borderRadius: 8, backgroundColor: colors.lac2 }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.bone }} numberOfLines={2}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PINK_BANNER, borderRadius: radii.card, padding: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb size={22} color={colors.hi} weight="fill" />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.bone2 }}>
              Different categories unmask different truths. Each category uses a tailored set of questions, sources and insights.
            </Text>
            <Pressable style={{ backgroundColor: '#F5D5DC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.hi }}>Learn more</Text>
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Fire size={22} color={colors.coral} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone }}>What people are unmasking</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone2 }}>Trending products this week on Unmask</Text>
              </View>
              <Pressable onPress={() => router.push('/pulse' as Href)}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>See all ›</Text>
              </Pressable>
            </View>
            {pulse.isLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: trendGap }}>
                {Array.from({ length: TRENDING_VISIBLE }, (_, i) => (
                  <Shimmer key={i} height={trendingWidth * 1.1} width={trendingWidth} radius={12} />
                ))}
              </ScrollView>
            ) : mixedTrending.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: trendGap, paddingRight: SCREEN_PAD_H }}>
                {mixedTrending.map((t) => (
                  <SearchTrendingCard key={t.id} item={t} onPress={() => openTrending(t)} width={trendingWidth} />
                ))}
              </ScrollView>
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Search something to get started.</Text>
            )}
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ArrowsLeftRight size={20} color={colors.hi} weight="bold" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone }}>Unmask side-by-side</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone2 }}>Real comparisons from real people</Text>
              </View>
              <Pressable onPress={() => router.push('/pulse' as Href)}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.hi }}>See all ›</Text>
              </Pressable>
            </View>
            {compares.length ? (
              compares.map((t) => <CompareRow key={t.id} thread={t} onPress={() => openThread(t.id)} />)
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>No comparisons yet — start one from a product page.</Text>
            )}
          </View>

          {conversationCards.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Fire size={20} color={colors.coral} weight="fill" />
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Hot conversations</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: convoGap }}>
                {conversationCards.slice(0, 6).map(({ item, title, postCount, thread }) => (
                  <PulseConversationCard
                    key={thread.id}
                    item={item}
                    title={title}
                    postCount={postCount}
                    width={convoCardW}
                    onPress={() => openThread(thread.id)}
                  />
                ))}
              </ScrollView>
              <Pressable
                onPress={() => router.push('/pulse' as Href)}
                style={{ alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.hi }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>View more on Pulse</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push('/pulse' as Href)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: BLUE_BANNER, borderRadius: radii.card, padding: 16 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}>
              <ChatsCircle size={24} color={colors.hi} weight="fill" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.bone }}>Questions people want to unmask</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone2 }}>Get real answers from people who have used these products</Text>
            </View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>Explore Pulse ›</Text>
          </Pressable>
        </View>
      </ScrollView>
      {scan.sheet}
    </Screen>
  );
}

function StepCard({ n, title, body, extra, width }: { n: number; title: string; body: string; extra?: ReactNode; width: number }) {
  return (
    <View style={{ width, backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 12, padding: 8, gap: 4, alignItems: 'center' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.white }}>{n}</Text>
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.bone, textAlign: 'center' }} numberOfLines={2}>
        {title}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 9, lineHeight: 12, color: colors.bone2, textAlign: 'center' }} numberOfLines={2}>
        {body}
      </Text>
      {extra}
    </View>
  );
}

function SearchTrendingCard({
  item,
  width,
  onPress,
}: {
  item: TrendingProduct;
  width: number;
  onPress: () => void;
}) {
  const signal = item.views ? `${compact(item.views)} searching` : 'Trending now';
  const imageSize = width;
  return (
    <Pressable onPress={() => { hapticTap(); onPress(); }} style={{ width, gap: 6 }}>
      <View>
        <ProductImage uri={item.image} category={item.category} size={imageSize} radius={12} style={{ width: imageSize, height: imageSize * 0.72 }} />
      </View>
      <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 14, color: colors.bone }}>{item.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4A7FD4' }} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.bone2 }} numberOfLines={1}>{signal}</Text>
      </View>
    </Pressable>
  );
}

function CompareRow({ thread, onPress }: { thread: CommunityThread; onPress: () => void }) {
  const ago = timeAgo(thread.last_activity_at || thread.created_at);
  return (
    <Pressable
      onPress={() => { hapticTap(); onPress(); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lac, borderRadius: radii.card, padding: 12, borderWidth: 1, borderColor: colors.line }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', width: 88 }}>
        <ProductImage uri={thread.product_image} category={thread.category ?? ''} size={40} radius={10} />
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.wineDeep, alignItems: 'center', justifyContent: 'center', marginHorizontal: -8, zIndex: 1, borderWidth: 2, borderColor: colors.lac }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.bone2 }}>VS</Text>
        </View>
        <ProductImage uri={thread.compare_image} category={thread.category ?? ''} size={40} radius={10} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: colors.bone }} numberOfLines={3}>{thread.title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>{thread.reply_count} replies · {ago}</Text>
      </View>
      <CaretRight size={16} color={colors.bone3} weight="bold" />
    </Pressable>
  );
}
