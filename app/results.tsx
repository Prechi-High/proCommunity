import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { MagnifyingGlass, categoryIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Chip, Notice } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { getAllProducts, getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { hapticTap } from '@/lib/haptics';
import { searchCatalog } from '@/lib/products';
import { scoreBand } from '@/lib/scoreBand';
import { useAppStore } from '@/lib/store';
import type { Product } from '@/lib/types';

export default function ResultsScreen() {
  const { q = '' } = useLocalSearchParams<{ q?: string }>();
  const query = typeof q === 'string' ? q : '';
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);

  // Extract universal search parameters
  const universalResult = useMemo(() => {
    const params = useLocalSearchParams();
    const name = params.universalName as string | undefined;
    const brand = params.universalBrand as string | undefined;
    const category = params.universalCategory as string | undefined;
    const description = params.universalDescription as string | undefined;
    const confidence = parseFloat(params.universalConfidence as string | '0') || 0;
    let keyFeatures: string[] = [];
    try {
      keyFeatures = JSON.parse(params.universalKeyFeatures as string | '[]');
    } catch {
      keyFeatures = [];
    }
    const provider = params.universalProvider as string | undefined;
    const model = params.universalModel as string | undefined;

    if (name || brand || category) {
      return { name, brand, category, description, confidence, keyFeatures, provider, model };
    }
    return null;
  }, [
    useLocalSearchParams().universalName,
    useLocalSearchParams().universalBrand,
    useLocalSearchParams().universalCategory,
    useLocalSearchParams().universalDescription,
    useLocalSearchParams().universalConfidence,
    useLocalSearchParams().universalKeyFeatures,
    useLocalSearchParams().universalProvider,
    useLocalSearchParams().universalModel,
  ]);

  const { data: list = [], isFetching } = useQuery({
    queryKey: ['results', query],
    queryFn: () => searchCatalog(query),
    enabled: query.length > 0,
  });

  const unmatched = !isFetching && query.length > 0 && list.length === 0;
  const source = unmatched ? getAllProducts() : list;

  const sorted = useMemo(() => {
    return [...source].sort((a, b) => {
      const sa = computeConfidence(a, profile, getProductPosts(a.id, userPosts)).compositeScore ?? 0;
      const sb = computeConfidence(b, profile, getProductPosts(b.id, userPosts)).compositeScore ?? 0;
      return sb - sa;
    });
  }, [source, profile, userPosts]);

  return (
    <Screen>
      <Pressable
        onPress={() => router.replace('/(tabs)')}
        style={{
          marginTop: 8,
          height: 54,
          borderRadius: 16,
          backgroundColor: colors.bone,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
        }}
      >
        <MagnifyingGlass size={20} color={colors.wine} weight="regular" />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.wine }} numberOfLines={1}>
          {query || 'Search'}
        </Text>
      </Pressable>

      {universalResult && (
        <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.rosewoodSoft, borderRadius: 12 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone, marginBottom: 4 }}>
            Identified Product
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>
            {universalResult.name || 'Unknown Product'}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
            {universalResult.brand || 'Unknown Brand'} • {universalResult.category || 'General'}
          </Text>
          {universalResult.confidence && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3, marginTop: 4 }}>
              Confidence: {(universalResult.confidence * 100).toFixed(0)}%
            </Text>
          )}
        </View>
      )}

      {!isUniversalSearch && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
          <Chip label="Skincare" selected />
          <Chip label="Oily skin" />
          <Chip label="Fragrance-free" />
        </ScrollView>
      )}

      {unmatched ? (
        <View style={{ marginTop: 14 }}>
          <Notice>We don’t cover that one yet. Here’s everything we can investigate right now.</Notice>
        </View>
      ) : null}

      <Text style={{ marginTop: 16, marginBottom: 4, fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
        {isFetching ? 'Looking…' : `${sorted.length} products, sorted by verdict`}
      </Text>

      {isFetching ? <ActivityIndicator color={colors.hi} style={{ marginTop: 24 }} /> : null}

      {/* Universal Search Result Display */}
      {universalResult && (
        <View style={{ marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: colors.rosewoodSoft }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.bone2, marginBottom: 8 }}>
            Identified from Image
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.bone }}>
                {universalResult.name || 'Unknown Product'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone3 }}>
                {universalResult.brand || 'Unknown Brand'}
              </Text>
              {universalResult.category && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, marginTop: 4 }}>
                  Category: {universalResult.category}
                </Text>
              )}
              {universalResult.confidence && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
                  Confidence: {(universalResult.confidence * 100).toFixed(0)}%
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => {
                hapticTap();
                router.push({
                  pathname: '/probe/[id]',
                  params: { 
                    id: `universal-${Date.now()}`,
                    universalName: universalResult.name,
                    universalBrand: universalResult.brand,
                    universalCategory: universalResult.category,
                    universalDescription: universalResult.description,
                    universalConfidence: String(universalResult.confidence ?? 0),
                    universalKeyFeatures: JSON.stringify(universalResult.keyFeatures || []),
                    universalProvider: universalResult.provider,
                    universalModel: universalResult.model,
                  } as Href
                });
              }}
              style={{ padding: 8, borderRadius: 8, backgroundColor: colors.wine }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone }}>View Details</Text>
            </Pressable>
          </View>
        </View>
      )}

      {sorted.map((product) => (
        <ResultRow
          key={product.id}
          product={product}
          onPress={() => {
            hapticTap();
            router.push(`/probe/${product.id}`);
          }}
        />
      ))}
    </Screen>
  );
}

function ResultRow({ product, onPress }: { product: Product; onPress: () => void }) {
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const breakdown = computeConfidence(product, profile, getProductPosts(product.id, userPosts));
  const score = breakdown.compositeScore;
  const pos = breakdown.sentimentScore ?? 55;
  const mix = Math.max(8, Math.min(30, 100 - pos - 18));
  const neg = Math.max(5, 100 - pos - mix);
  const thin = score == null;
  const band = scoreBand(score);

  const Icon = categoryIcon(product.category);

  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {product.heroImageUrl ? (
          <Image
            source={{ uri: product.heroImageUrl }}
            style={{
              width: 48,
              height: 60,
              borderRadius: radii.card,
              backgroundColor: colors.lac,
              resizeMode: 'contain',
            }}
          />
        ) : (
          <View style={{ width: 48, height: 60, borderRadius: radii.card, backgroundColor: colors.lac2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={24} color={colors.bone2} weight="regular" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone, lineHeight: 20 }}>
            {product.name}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3, marginTop: 2 }}>
            {product.brand}
          </Text>
        </View>
        {thin ? (
          <View style={{ alignItems: 'flex-end', maxWidth: 90 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.bone3, textAlign: 'right' }}>
              No score
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, marginTop: 4 }}>
              Too little evidence
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                fontFamily: fonts.serif,
                fontSize: 32,
                fontWeight: '500',
                color: colors.bone,
                letterSpacing: -1,
                lineHeight: 32,
              }}
            >
              {score}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, marginTop: 4 }}>
              {band}
            </Text>
          </View>
        )}
      </View>
      {!thin ? (
        <View style={{ flexDirection: 'row', gap: 2, height: 7, marginTop: 8, marginLeft: 62 }}>
          <View style={{ flex: pos, borderRadius: 4, backgroundColor: colors.sage }} />
          <View style={{ flex: mix, borderRadius: 4, backgroundColor: colors.honey }} />
          <View style={{ flex: neg, borderRadius: 4, backgroundColor: colors.coral }} />
        </View>
      ) : null}
      <Text style={{ marginLeft: 62, marginTop: 6, fontFamily: fonts.regular, fontSize: 12.5, color: colors.bone3 }}>
        {thin ? 'Comments so far' : 'Comments from live sources'}
      </Text>
    </Pressable>
  );
}
