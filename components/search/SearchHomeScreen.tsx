import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

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
  Scales,
  Star,
  TShirt,
  Warning,
} from '@/components/icons';
import { ProductImage, SearchBar, Shimmer } from '@/components/kit';
import { brandAssets } from '@/constants/brand';
import { SEARCH_CATEGORY_IMAGE_URLS, SEARCH_HOME_CATEGORIES } from '@/constants/searchHome';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { fetchPulse, nicheOf, timeAgo } from '@/lib/community';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { rememberProduct } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { CommunityThread, TrendingProduct } from '@/lib/types';
import { useScan } from '@/lib/useScan';

const PINK = ['#FDF2F4', '#F8E4E9', '#FDF2F4'] as const;
const PINK_BANNER = '#F9E8EC';
const BLUE_BANNER = '#E8F0FA';

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function HeroIllustration() {
  return (
    <View style={{ width: 132, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 16,
          backgroundColor: colors.lac,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-6deg' }],
          ...elevation.raised,
        }}
      >
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 42, color: colors.hi, marginTop: -4 }}>U</Text>
      </View>
      <View style={{ position: 'absolute', top: 4, right: -4, backgroundColor: colors.lac, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, ...elevation.raised }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Star size={12} color={colors.gold} weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.bone }}>Real reviews</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', top: 44, right: -12, backgroundColor: colors.lac, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, ...elevation.raised }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Warning size={12} color={colors.coral} weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.bone }}>Hidden issues</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', bottom: 8, right: -8, backgroundColor: colors.lac, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, ...elevation.raised }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Scales size={12} color={colors.hi} weight="bold" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.bone }}>Side-by-side</Text>
        </View>
      </View>
    </View>
  );
}

function StepMiniIcons() {
  const items = [
    { Icon: DeviceMobile, bg: '#E8F4FF' },
    { Icon: Flower, bg: '#FCE8F0' },
    { Icon: House, bg: '#FFF4E5' },
    { Icon: TShirt, bg: '#EDE8FF' },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: 120 }}>
      {items.map(({ Icon, bg }, i) => (
        <View key={i} style={{ width: 52, height: 44, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={colors.bone} weight="bold" />
        </View>
      ))}
    </View>
  );
}

const SCREEN_PAD_H = 8;
const CATEGORY_COLS = 4;
const TRENDING_COLS = 3;

export function SearchHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const catGap = 8;
  const categoryWidth = (width - SCREEN_PAD_H * 2 - catGap * (CATEGORY_COLS - 1)) / CATEGORY_COLS;
  const trendGap = 8;
  const trendingWidth = (width - SCREEN_PAD_H * 2 - trendGap * (TRENDING_COLS - 1)) / TRENDING_COLS;
  const [query, setQuery] = useState('');
  const scan = useScan();
  const selectedCategories = useAppStore((s) => s.searchCategoryIds);
  const toggleCategory = useAppStore((s) => s.toggleSearchCategory);

  const pulse = useQuery({ queryKey: ['pulse'], queryFn: () => fetchPulse(), staleTime: 60_000 });
  const trending = pulse.data?.trending ?? [];
  const compares = (pulse.data?.threads ?? []).filter((t) => t.kind === 'compare').slice(0, 2);
  const questions = (pulse.data?.threads ?? []).filter((t) => t.kind === 'question').slice(0, 1);

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
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

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.hi, textTransform: 'uppercase' }}>
                Research. Compare. Unmask.
              </Text>
              <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: colors.bone }}>
                Unmask what you&apos;re about to buy.
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2 }}>
                Real product facts, real experiences, real people.
              </Text>
            </View>
            <HeroIllustration />
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
            style={{ marginHorizontal: -SCREEN_PAD_H, paddingVertical: 16, gap: 14 }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone, textAlign: 'center', paddingHorizontal: SCREEN_PAD_H }}>
              3 simple steps to <Text style={{ fontFamily: fonts.serifBold, color: colors.hi }}>unmask</Text> any product
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingHorizontal: SCREEN_PAD_H }}>
              <StepCard
                n={1}
                title="Choose a category"
                body="Get the right investigation template"
                extra={<StepMiniIcons />}
              />
              <StepCard
                n={2}
                title="Search or snap"
                body="Type a product or take a photo"
                extra={
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <View style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
                      <MagnifyingGlass size={20} color={colors.bone3} weight="bold" />
                    </View>
                    <View style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
                      <Scan size={20} color={colors.white} weight="bold" />
                    </View>
                  </View>
                }
              />
              <StepCard
                n={3}
                title="Unmask the product"
                body="See real facts, reviews, comparisons and more"
                extra={
                  <View style={{ marginTop: 6, height: 48, borderRadius: 10, backgroundColor: colors.lac, borderWidth: 1, borderColor: colors.line, padding: 8, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.hi }}>Unmask scorecard</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.bone3 }}>Evidence · Videos · Ask</Text>
                  </View>
                }
              />
            </ScrollView>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: catGap }}>
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
                      style={{ width: '100%', height: 52, borderRadius: 8 }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.bone }} numberOfLines={2}>
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: trendGap }}>
                {Array.from({ length: TRENDING_COLS }, (_, i) => (
                  <Shimmer key={i} height={trendingWidth * 1.05} width={trendingWidth} radius={12} />
                ))}
              </View>
            ) : trending.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: trendGap }}>
                {trending.slice(0, 6).map((t, i) => (
                  <SearchTrendingCard
                    key={t.id}
                    item={t}
                    rank={i + 1}
                    onPress={() => openTrending(t)}
                    width={trendingWidth}
                  />
                ))}
              </View>
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
              compares.map((t) => <CompareRow key={t.id} thread={t} onPress={() => router.push({ pathname: '/thread/[id]', params: { id: t.id } } as Href)} />)
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>No comparisons yet — start one from a product page.</Text>
            )}
          </View>

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

          {questions[0] ? (
            <Pressable
              onPress={() => router.push({ pathname: '/thread/[id]', params: { id: questions[0].id } } as Href)}
              style={{ backgroundColor: colors.lac, borderRadius: radii.card, padding: 14, borderWidth: 1, borderColor: colors.line }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }} numberOfLines={2}>{questions[0].title}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      {scan.sheet}
    </Screen>
  );
}

function StepCard({ n, title, body, extra }: { n: number; title: string; body: string; extra?: ReactNode }) {
  return (
    <View style={{ width: 168, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 14, padding: 12, gap: 6 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}>{n}</Text>
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone }}>{title}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.bone2 }}>{body}</Text>
      {extra}
    </View>
  );
}

function SearchTrendingCard({
  item,
  rank,
  width,
  onPress,
}: {
  item: TrendingProduct;
  rank: number;
  width: number;
  onPress: () => void;
}) {
  const signal = item.views ? `${compact(item.views)} searching` : 'Trending now';
  const imageSize = width;
  return (
    <Pressable onPress={() => { hapticTap(); onPress(); }} style={{ width, gap: 6 }}>
      <View>
        <ProductImage uri={item.image} category={item.category} size={imageSize} radius={12} style={{ width: imageSize, height: imageSize * 0.72 }} />
        <View style={{ position: 'absolute', top: 6, left: 6, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.white }}>{rank}</Text>
        </View>
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
