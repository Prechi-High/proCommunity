import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Caption, Chip } from '@/components/ui';
import { MagnifyingGlass } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { searchCatalog } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { Product } from '@/lib/types';

/**
 * Results — exact sourced-v1 list after a multi-match search.
 * Tap a row → investigation probe (not straight to case).
 */
export default function ResultsScreen() {
  const { q = '' } = useLocalSearchParams<{ q?: string }>();
  const query = typeof q === 'string' ? q : '';
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);

  const { data: list = [], isFetching } = useQuery({
    queryKey: ['results', query],
    queryFn: () => searchCatalog(query),
    enabled: query.length > 0,
  });

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const sa = computeConfidence(a, profile, getProductPosts(a.id, userPosts)).compositeScore ?? 0;
      const sb = computeConfidence(b, profile, getProductPosts(b.id, userPosts)).compositeScore ?? 0;
      return sb - sa;
    });
  }, [list, profile, userPosts]);

  const emptyHint = !isFetching && query && sorted.length === 0;

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
        <Chip label="Skincare" selected />
        <Chip label="Oily skin" />
        <Chip label="Fragrance-free" />
      </ScrollView>

      {emptyHint ? (
        <View style={{ marginTop: 14 }}>
          <Caption color={colors.bone2}>
            We don’t cover that one yet. Here’s everything we can investigate right now — try a broader term.
          </Caption>
        </View>
      ) : null}

      <Text style={{ marginTop: 16, marginBottom: 4, fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>
        {isFetching ? 'Looking…' : `${sorted.length} products, sorted by Product Score`}
      </Text>

      {isFetching ? <ActivityIndicator color={colors.hi} style={{ marginTop: 24 }} /> : null}

      {sorted.map((product) => (
        <ResultRow
          key={product.id}
          product={product}
          onPress={() => router.push(`/probe/${product.id}`)}
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

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        gap: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 48,
            height: 60,
            borderRadius: 12,
            backgroundColor: colors.lac,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22 }}>🧴</Text>
        </View>
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
            {profile?.skinType && profile.skinType !== 'unknown' && breakdown.fitMatchScore != null ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3, marginTop: 4 }}>
                Fit {breakdown.fitMatchScore}
              </Text>
            ) : null}
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
