import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import {
  ClaimRows,
  ExperienceSplit,
  PriceSignal,
  ProductIdentityHero,
  VerdictMoment,
} from '@/components/product/JourneySections';
import { LiteracyRail } from '@/components/product/LiteracyRail';
import { Screen } from '@/components/Screen';
import { Caption, Disclaimer } from '@/components/ui';
import { ArrowLeft, Heart } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { hapticMarked, hapticTap, hapticVerdictLand } from '@/lib/haptics';
import { loadProductCase } from '@/lib/productCase';
import { assembleProductJourney } from '@/lib/productJourney';
import { useAppStore } from '@/lib/store';
import { useProduct } from '@/lib/useProduct';

export default function ProductCaseScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = routeId(rawId ?? '');
  const router = useRouter();
  const { data: product, isLoading: productLoading } = useProduct(id);
  const userPosts = useAppStore((s) => s.userPosts);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  const analysisQuery = useQuery({
    queryKey: ['product-case', product?.id],
    queryFn: () => loadProductCase(product!, userPosts),
    enabled: Boolean(product),
    staleTime: 30 * 60 * 1000,
  });

  const journeyQuery = useQuery({
    queryKey: ['product-journey', product?.id, analysisQuery.dataUpdatedAt],
    queryFn: () => assembleProductJourney(product!, analysisQuery.data),
    enabled: Boolean(product) && (analysisQuery.isSuccess || analysisQuery.isError),
    staleTime: 15 * 60 * 1000,
  });

  const journey = journeyQuery.data;
  const analysis = analysisQuery.data;

  useEffect(() => {
    if (analysis?.productScore != null) {
      hapticVerdictLand();
      hapticMarked();
    }
  }, [analysis?.analyzedAt, analysis?.productScore]);

  if (productLoading || !product) {
    return (
      <Screen>
        <ActivityIndicator color={colors.hi} style={{ marginTop: 48 }} />
        <Caption>{productLoading ? 'Opening this product…' : 'Product not found.'}</Caption>
      </Screen>
    );
  }

  const saved = favorites.some((item) => item.productId === product.id);

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
            accessibilityLabel="Save product"
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: saved ? colors.lac2 : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Heart size={22} color={saved ? colors.hi : colors.bone} weight={saved ? 'fill' : 'regular'} />
          </Pressable>
          <Pressable
            onPress={() => {
              hapticTap();
              router.push(`/product/${product.id}/community`);
            }}
            style={{
              flex: 1,
              height: 58,
              borderRadius: 18,
              backgroundColor: colors.hi,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.wine }}>Ask the community</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12 }}>
        <Pressable
          onPress={() => {
            hapticTap();
            router.back();
          }}
          accessibilityLabel="Go back"
          style={{ width: 44, height: 44, justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.bone} weight="bold" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProductIdentityHero
          brand={journey?.brand ?? product.brand}
          name={journey?.name ?? product.name}
          primaryImage={journey?.primaryImage ?? product.heroImageUrl ?? null}
          gallery={journey?.gallery ?? []}
          confidenceBand={journey?.confidenceBand ?? 'Likely'}
          category={journey?.category ?? product.category}
        />

        {(journeyQuery.isFetching || analysisQuery.isFetching) && !journey ? (
          <Caption>Gathering what’s known…</Caption>
        ) : null}

        <VerdictMoment
          score={journey?.score ?? analysis?.productScore ?? null}
          verdict={journey?.verdict ?? analysis?.verdict ?? null}
          basis={journey?.basis ?? analysis?.basis ?? null}
          tooFew={journey?.tooFew ?? Boolean(analysis?.tooFew)}
          loading={analysisQuery.isLoading}
        />

        <ExperienceSplit
          praise={journey?.praise ?? []}
          complaints={journey?.complaints ?? []}
          signalCount={journey?.signalCount ?? 0}
        />

        <ClaimRows
          claims={journey?.claims ?? []}
          expandedKey={expandedClaim}
          onToggle={(key) => setExpandedClaim((prev) => (prev === key ? null : key))}
        />

        <PriceSignal price={journey?.price ?? null} priceRange={journey?.priceRange ?? null} />

        <LiteracyRail clips={journey?.literacyVideos ?? []} notes={journey?.literacyNotes ?? []} />

        <View style={{ marginTop: 20 }}>
          <Pressable
            onPress={() => {
              hapticTap();
              router.push(`/product/${product.id}/stores`);
            }}
            style={{
              height: 52,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, color: colors.bone }}>Get this product</Text>
          </Pressable>
          <Caption>Stores appear only when you’re ready</Caption>
        </View>

        <View style={{ marginTop: 18 }}>
          <Disclaimer compact />
        </View>
      </ScrollView>
    </Screen>
  );
}
