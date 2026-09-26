import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  const params = useLocalSearchParams<{
    q?: string;
    universalName?: string;
    universalBrand?: string;
    universalCategory?: string;
    universalDescription?: string;
    universalConfidence?: string;
    universalKeyFeatures?: string;
    universalProvider?: string;
    universalModel?: string;
  }>();
  const query = typeof params.q === 'string' ? params.q : '';
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);

  // Photo-identified product — skip Open Beauty Facts catalog search.
  const universalResult = useMemo(() => {
    const name = typeof params.universalName === 'string' ? params.universalName : undefined;
    const brand = typeof params.universalBrand === 'string' ? params.universalBrand : undefined;
    const category = typeof params.universalCategory === 'string' ? params.universalCategory : undefined;
    const description =
      typeof params.universalDescription === 'string' ? params.universalDescription : undefined;
    const confidence = parseFloat(params.universalConfidence ?? '0') || 0;
    let keyFeatures: string[] = [];
    try {
      keyFeatures = JSON.parse(params.universalKeyFeatures ?? '[]');
    } catch {
      keyFeatures = [];
    }
    const provider = typeof params.universalProvider === 'string' ? params.universalProvider : undefined;
    const model = typeof params.universalModel === 'string' ? params.universalModel : undefined;

    if (name || brand || category) {
      return { name, brand, category, description, confidence, keyFeatures, provider, model };
    }
    return null;
  }, [
    params.universalName,
    params.universalBrand,
    params.universalCategory,
    params.universalDescription,
    params.universalConfidence,
    params.universalKeyFeatures,
    params.universalProvider,
    params.universalModel,
  ]);

  const { data: list = [], isFetching } = useQuery({
    queryKey: ['results', query],
    queryFn: () => searchCatalog(query),
    // Photo ID already named the product — do not hit Open Beauty Facts.
    enabled: query.length > 0 && !universalResult,
  });

  const unmatched = !isFetching && query.length > 0 && list.length === 0 && !universalResult;
  const source = universalResult ? [] : (unmatched ? getAllProducts() : list);

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
        <View style={{ marginTop: 12, padding: 16, backgroundColor: colors.rosewoodSoft, borderRadius: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone, marginBottom: 8 }}>
            Identified Product
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.bone }}>
            {universalResult.name || 'Unknown Product'}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone3, marginTop: 4 }}>
            Brand: {universalResult.brand || 'Unknown Brand'}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone3 }}>
            Category: {universalResult.category || 'General'}
          </Text>
          {universalResult.description && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3, marginTop: 8, lineHeight: 18 }}>
              {universalResult.description}
            </Text>
          )}
          {universalResult.keyFeatures && universalResult.keyFeatures.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2, marginBottom: 4 }}>
                Key Features:
              </Text>
              {universalResult.keyFeatures.slice(0, 5).map((feature, index) => (
                <Text key={index} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, marginLeft: 8 }}>
                  • {feature}
                </Text>
              ))}
            </View>
          )}
          {universalResult.confidence && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.bone3, marginTop: 8 }}>
              Confidence: {(universalResult.confidence * 100).toFixed(0)}% • Identified by {universalResult.provider || 'AI'}
            </Text>
          )}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, marginTop: 12, fontStyle: 'italic' }}>
            Identified from your photo. Tap search above to look for matching products in our catalog.
          </Text>
        </View>
      )}

      {!universalResult && (
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
        {isFetching ? 'Looking…' : universalResult ? 'Related products in our database' : `${sorted.length} products, sorted by verdict`}
      </Text>

      {isFetching ? <ActivityIndicator color={colors.hi} style={{ marginTop: 24 }} /> : null}

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
            }}
            resizeMode="contain"
            onError={() => console.log('Failed to load image:', product.heroImageUrl)}
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
