import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ResearchOverlay } from '@/components/brand/ResearchOverlay';
import { ArrowClockwise, ArrowLeft, MagnifyingGlass } from '@/components/icons';
import { Eyebrow, FeatureCard, Group, PrimaryButton, ProductRow, SearchBar, Shimmer } from '@/components/kit';
import { BRAND_COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import { displayName, rememberProduct, searchProducts, slugify } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import { stageForTextSearch } from '@/lib/research/overlayStages';
import { nextResearchRequestId } from '@/lib/research/requestScope';
import { useResearchElapsed } from '@/lib/research/useResearchElapsed';
import { useScan } from '@/lib/useScan';
import type { Product } from '@/lib/types';

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const initial = typeof params.q === 'string' ? params.q : '';
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [category, setCategory] = useState<string>('All');
  const addSearch = useAppStore((s) => s.addSearch);
  const scan = useScan();
  const requestRef = useRef<string | null>(null);

  useEffect(() => {
    setDraft(initial);
    setQuery(initial);
  }, [initial]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchProducts(query),
    enabled: query.trim().length > 1,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const products = data?.products ?? [];
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1));
    return [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 6);
  }, [products]);
  const filtered = category === 'All' ? products : products.filter((p) => p.category === category);
  const [top, ...rest] = filtered;

  const open = (p: Product) => {
    rememberProduct(p);
    router.push({ pathname: '/product/[id]', params: { id: p.id, q: displayName(p) } } as Href);
  };

  const investigateQuery = () => {
    const id = slugify(query);
    rememberProduct({ id, name: query, brand: '', category: 'Product' });
    router.push({ pathname: '/product/[id]', params: { id, q: query } } as Href);
  };

  const submit = () => {
    const t = draft.trim();
    if (!t) {
      return;
    }
    requestRef.current = nextResearchRequestId();
    addSearch(t);
    setCategory('All');
    setQuery(t);
  };

  const searching = query.trim().length > 1 && (isLoading || isFetching);
  const elapsed = useResearchElapsed(searching);
  const researchStage = stageForTextSearch({ fetching: searching, hasResults: Boolean(data?.products?.length), elapsedMs: elapsed });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Back"
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <SearchBar value={draft} onChangeText={setDraft} onSubmit={submit} onScan={scan.start} busy={scan.busy} />
        </View>
      </View>

      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}
        >
          {['All', ...categories].map((c) => {
            const on = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  hapticSelect();
                  setCategory(c);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: on ? colors.black : colors.lac,
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: on ? colors.white : colors.bone }}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 18 }} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <View style={{ gap: 16 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone2 }}>
              Searching stores, reviews and the web…
            </Text>
            <Shimmer height={144} radius={22} />
            <Group>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 14, paddingVertical: 12 }}>
                  <Shimmer height={68} width={68} radius={14} />
                  <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
                    <Shimmer height={14} width="80%" />
                    <Shimmer height={12} width="40%" />
                  </View>
                </View>
              ))}
            </Group>
          </View>
        ) : isError ? (
          <View style={{ alignItems: 'center', gap: 14, paddingTop: 60 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.bone }}>Search didn’t go through</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center' }}>
              Check your connection and try again.
            </Text>
            <PrimaryButton label={isFetching ? 'Retrying…' : 'Try again'} icon={ArrowClockwise} onPress={() => void refetch()} />
          </View>
        ) : top ? (
          <>
            <Eyebrow>{BRAND_COPY.resultsIntro}</Eyebrow>
            <FeatureCard product={top} label="Best match" onPress={() => open(top)} />
            {rest.length ? (
              <View style={{ gap: 8 }}>
                <Eyebrow>{`${rest.length} more ${rest.length === 1 ? 'result' : 'results'}`}</Eyebrow>
                <Group>
                  {rest.map((p, i) => (
                    <View key={p.id} style={{ borderBottomWidth: i === rest.length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
                      <ProductRow product={p} onPress={() => open(p)} />
                    </View>
                  ))}
                </Group>
              </View>
            ) : null}
            <Pressable onPress={investigateQuery} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.hi }}>
                Not here? Investigate “{query}” directly
              </Text>
            </Pressable>
          </>
        ) : query ? (
          <View style={{ alignItems: 'center', gap: 14, paddingTop: 60, paddingHorizontal: 12 }}>
            <MagnifyingGlass size={36} color={colors.bone3} weight="regular" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.bone, textAlign: 'center' }}>
              No listings for “{query}”
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center', lineHeight: 20 }}>
              We can still build its profile from reviews, specs and discussions across the web.
            </Text>
            <PrimaryButton label="Investigate this product" onPress={investigateQuery} />
          </View>
        ) : null}
      </ScrollView>
      {scan.sheet}
      <ResearchOverlay
        visible={searching}
        stage={researchStage}
        onCancel={() => {
          setQuery('');
          setDraft('');
        }}
      />
    </SafeAreaView>
  );
}
