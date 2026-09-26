import { useMemo, useState } from 'react';
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
import { ArrowLeft } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { investigateProductIntelligence, type ProductJourney } from '@/lib/productJourney';

/**
 * Confidence journey for photo/text-identified products that are not yet
 * in the catalog. Uses Product Intelligence Organisation investigate.
 */
export default function IntelProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string;
    name?: string;
    brand?: string;
    category?: string;
    description?: string;
    confidence?: string;
  }>();
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  const name = (typeof params.name === 'string' && params.name) || (typeof params.q === 'string' ? params.q : 'Product');
  const brand = typeof params.brand === 'string' ? params.brand : 'Unknown';
  const category = typeof params.category === 'string' ? params.category : 'general';
  const description = typeof params.description === 'string' ? params.description : '';
  const seedConfidence = parseFloat(params.confidence ?? '0.7') || 0.7;
  const query = `${brand !== 'Unknown' ? brand : ''} ${name}`.trim();

  const intelQuery = useQuery({
    queryKey: ['intel-journey', query],
    queryFn: () => investigateProductIntelligence(query),
    enabled: query.length >= 2,
    staleTime: 15 * 60 * 1000,
  });

  const journey = useMemo((): ProductJourney => {
    const intel = intelQuery.data?.intelligence ?? {};
    const praise = intelQuery.data?.praise ?? [];
    const complaints = intelQuery.data?.complaints ?? [];
    const sources = intelQuery.data?.sources ?? [];
    const images = intelQuery.data?.images ?? [];
    const claims: ProductJourney['claims'] = [];

    const pushClaim = (key: string, label: string, value: unknown) => {
      if (value == null || value === '') return;
      const text = Array.isArray(value) ? value.join(', ') : String(value);
      if (!text.trim()) return;
      claims.push({
        key,
        label,
        value: text.slice(0, 220),
        confidence: Number(intelQuery.data?.confidence ?? seedConfidence),
        provenance: sources[0]
          ? `Source · ${sources[0].replace(/^https?:\/\//, '').split('/')[0]}`
          : 'Product intelligence',
      });
    };

    pushClaim('description', 'What it is', intel.description || description);
    pushClaim('how_to_use', 'How to use', intel.how_to_use);
    pushClaim('ingredients', 'Ingredients / materials', intel.ingredients || intel.ingredients_or_materials);
    pushClaim('availability', 'Availability', intel.availability);
    pushClaim('price', 'Price', intel.price);
    for (let i = 1; i <= 5; i += 1) {
      pushClaim(`spec_${i}`, `Spec ${i}`, intel[`spec_${i}`]);
    }

    const confidence = Number(intelQuery.data?.confidence ?? seedConfidence);
    return {
      name: String(intel.product_name || name),
      brand: String(intel.brand || brand),
      category: String(intel.category || category),
      description: String(intel.description || description || '') || null,
      primaryImage: images[0] ?? null,
      gallery: images.slice(1, 5),
      identificationConfidence: confidence,
      confidenceBand: confidence >= 0.75 ? 'High' : confidence >= 0.45 ? 'Likely' : 'Uncertain',
      score: null,
      verdict: praise.length
        ? 'Worth understanding before you buy'
        : 'Fresh investigation — verify what matters to you',
      basis: sources.length
        ? `Built from ${sources.length} web sources. Lived owner score unlocks when more community proof lands.`
        : 'Identified from your input. We’re still collecting lived proof.',
      tooFew: true,
      praise: praise.slice(0, 3),
      complaints: complaints.slice(0, 3),
      signalCount: sources.length,
      claims: claims.slice(0, 6),
      price: null,
      priceRange: null,
      literacyVideos: [],
      literacyNotes: [],
      researching: intelQuery.isFetching,
      sources,
    };
  }, [intelQuery.data, intelQuery.isFetching, name, brand, category, description, seedConfidence]);

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12 }}>
        <Pressable
          onPress={() => {
            hapticTap();
            router.back();
          }}
          style={{ width: 44, height: 44, justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.bone} weight="bold" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProductIdentityHero
          brand={journey.brand}
          name={journey.name}
          primaryImage={journey.primaryImage}
          gallery={journey.gallery}
          confidenceBand={journey.confidenceBand}
          category={journey.category}
        />

        {intelQuery.isFetching ? (
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.hi} />
            <Caption>Investigating this product…</Caption>
          </View>
        ) : null}

        <VerdictMoment
          score={null}
          verdict={journey.verdict}
          basis={journey.basis}
          tooFew
          loading={false}
        />

        <ExperienceSplit praise={journey.praise} complaints={journey.complaints} signalCount={journey.signalCount} />

        <ClaimRows
          claims={journey.claims}
          expandedKey={expandedClaim}
          onToggle={(key) => setExpandedClaim((prev) => (prev === key ? null : key))}
        />

        <PriceSignal price={journey.price} priceRange={journey.priceRange} />

        <LiteracyRail clips={journey.literacyVideos} notes={journey.literacyNotes} />

        <View style={{ marginTop: 24 }}>
          <Disclaimer compact />
        </View>
      </ScrollView>
    </Screen>
  );
}
