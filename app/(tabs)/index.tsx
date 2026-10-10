import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Wordmark, BrandTagline } from '@/components/brand/Wordmark';
import { SectionHead, ThreadCard, TrendingCard } from '@/components/community';
import { Bell, CaretRight } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { SearchBar, Shimmer } from '@/components/kit';
import { colors, fonts, radii } from '@/constants/theme';
import { fetchPulse, NICHES } from '@/lib/community';
import { rememberProduct } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { TrendingProduct } from '@/lib/types';
import { useScan } from '@/lib/useScan';

const STEPS = [
  { n: 1, title: 'Choose a category', body: 'Tech, beauty, home & more' },
  { n: 2, title: 'Search or snap', body: 'Type a product or use your camera' },
  { n: 3, title: 'Unmask the product', body: 'See scores, evidence & owner truth' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const history = useAppStore((s) => s.searchHistory);
  const scan = useScan();
  const pulse = useQuery({ queryKey: ['pulse'], queryFn: () => fetchPulse(), staleTime: 60_000 });
  const trending = pulse.data?.trending ?? [];
  const threads = (pulse.data?.threads ?? []).slice(0, 3);
  const compares = (pulse.data?.threads ?? []).filter((t) => t.kind === 'compare').slice(0, 2);

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    useAppStore.getState().addSearch(trimmed);
    router.push({ pathname: '/results', params: { q: trimmed } } as Href);
  };

  const openTrending = (t: TrendingProduct) => {
    rememberProduct({ id: t.id, name: t.name, brand: t.brand, category: t.category, heroImageUrl: t.image });
    router.push({ pathname: '/product/[id]', params: { id: t.id, q: t.name } } as Href);
  };

  const searchCategory = (label: string) => go(label);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, gap: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <Wordmark height={36} />
            <BrandTagline />
          </View>
          <Pressable
            onPress={() => router.push('/notifications' as Href)}
            hitSlop={12}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell size={22} color={colors.bone} weight="bold" />
            <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.hi }} />
          </Pressable>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.2, color: colors.hi, textTransform: 'uppercase' }}>
            Research. Compare. Unmask.
          </Text>
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.8, color: colors.bone }}>
            Unmask what you&apos;re about to buy.
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.bone2 }}>
            Real product facts, real experiences, real people.
          </Text>
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSubmit={() => go(query)}
          onScan={scan.start}
          busy={scan.busy}
          placeholder="Search products, brands or questions…"
        />

        <View style={{ borderRadius: radii.card, backgroundColor: colors.hiSoft, padding: 16, gap: 14 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hiInk }}>3 simple steps to unmask any product</Text>
          {STEPS.map((s) => (
            <View key={s.n} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}>{s.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone }}>{s.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone2 }}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <SectionHead title="Choose what you want to unmask" action="See all" onAction={() => router.push('/pulse' as Href)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {NICHES.slice(0, 8).map((n) => (
              <Pressable
                key={n.id}
                onPress={() => searchCategory(n.label)}
                style={{
                  width: '47%',
                  flexGrow: 1,
                  backgroundColor: colors.lac,
                  borderRadius: radii.card,
                  padding: 14,
                  gap: 6,
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.bone }}>{n.label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone2 }} numberOfLines={2}>
                  Explore {n.label.toLowerCase()} products
                </Text>
                <CaretRight size={16} color={colors.hi} weight="bold" />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <SectionHead title="What people are unmasking" />
          {pulse.isLoading ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Shimmer height={190} width={148} radius={20} />
              <Shimmer height={190} width={148} radius={20} />
            </View>
          ) : trending.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
              {trending.slice(0, 8).map((t, i) => (
                <TrendingCard key={t.id} item={t} rank={i + 1} onPress={() => openTrending(t)} />
              ))}
            </ScrollView>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Search something to get started.</Text>
          )}
        </View>

        {compares.length ? (
          <View style={{ gap: 12 }}>
            <SectionHead title="Unmask side-by-side" />
            {compares.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: '/thread/[id]', params: { id: t.id } } as Href)}
                style={{ backgroundColor: colors.lac, borderRadius: radii.card, padding: 14, borderWidth: 1, borderColor: colors.line }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>{t.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone2, marginTop: 4 }}>{t.reply_count} replies</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {threads.length ? (
          <View style={{ gap: 12 }}>
            <SectionHead title="From Pulse" action="See all" onAction={() => router.push('/pulse' as Href)} />
            {threads.map((t) => (
              <ThreadCard key={t.id} thread={t} showProduct onPress={() => router.push({ pathname: '/thread/[id]', params: { id: t.id } } as Href)} />
            ))}
          </View>
        ) : null}

        {history.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.bone3, textTransform: 'uppercase' }}>Recent searches</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {history.slice(0, 6).map((h) => (
                <Pressable
                  key={h.query}
                  onPress={() => go(h.query)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.lac, borderWidth: 1, borderColor: colors.line }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone }}>{h.query}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
      {scan.sheet}
    </Screen>
  );
}
