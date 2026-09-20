import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Caption, Card, Chip, Heading, Thumb, Title } from '@/components/ui';
import { CaretRight, MagnifyingGlass, Scales, X } from '@/components/icons';
import { colors, fonts, radii, type } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { categoryLabel, getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { searchCatalog } from '@/lib/products';
import { BROWSE_CHIPS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';

/** Recognition over recall: colour carries the verdict before any reading starts. */
function matchTone(score: number): { bg: string; fg: string; label: string } {
  if (score >= 80) return { bg: colors.sageSoft, fg: colors.sageInk, label: 'Good fit' };
  if (score >= 60) return { bg: colors.honeySoft, fg: colors.honeyInk, label: 'Partial fit' };
  return { bg: colors.mist, fg: colors.inkSoft, label: 'Weak fit' };
}

/**
 * 03 — Search & Browse.
 *
 * The job is calm agency: scan a lot of options without decision fatigue. Each
 * row carries one colour-coded fit badge so the eye pattern-matches instead of
 * reading and calculating. No badge here implies urgency or competition.
 */
export default function SearchScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const userPosts = useAppStore((s) => s.userPosts);
  const addSearch = useAppStore((s) => s.addSearch);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [chip, setChip] = useState<string | undefined>();

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data: list = [], isFetching } = useQuery({
    queryKey: ['catalog', debounced, chip],
    queryFn: () => searchCatalog(debounced, chip),
  });

  const results = useMemo(
    () =>
      [...list].sort((a, b) => {
        const sa = computeConfidence(a, profile, getProductPosts(a.id, userPosts)).fitMatchScore;
        const sb = computeConfidence(b, profile, getProductPosts(b.id, userPosts)).fitMatchScore;
        return sb - sa;
      }),
    [list, profile, userPosts],
  );

  const knowsSkin = Boolean(profile?.skinType && profile.skinType !== 'unknown');

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Heading size={type.hLg}>Find a product</Heading>
        <Caption>Scan by fit first — no prices, no urgency labels.</Caption>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.white,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: radii.button,
          paddingHorizontal: 14,
        }}
      >
        <MagnifyingGlass size={17} color={colors.inkSoft} weight="regular" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            addSearch(query);
            track('search_submitted', { query });
          }}
          placeholder="Product, ingredient or concern"
          placeholderTextColor={colors.inkSoft}
          style={{
            flex: 1,
            paddingVertical: 14,
            fontFamily: fonts.regular,
            fontSize: 14,
            color: colors.ink,
          }}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={15} color={colors.inkSoft} weight="bold" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {BROWSE_CHIPS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={chip === item.value}
            onPress={() => setChip((current) => (current === item.value ? undefined : item.value))}
          />
        ))}
      </ScrollView>

      {/* Naming the absence of manipulation directly does more for trust than
          quietly hoping the ordering is assumed fair. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Scales size={13} color={colors.inkSoft} weight="regular" />
        <Caption>
          {isFetching
            ? 'Looking through Open Beauty Facts…'
            : knowsSkin
              ? `${results.length} products, ordered by fit with your skin. No brand can pay for this position.`
              : `${results.length} products. Add your skin type and this list reorders around you.`}
        </Caption>
      </View>

      {isFetching ? <ActivityIndicator color={colors.rosewood} /> : null}

      {results.map((product) => {
        const breakdown = computeConfidence(product, profile, getProductPosts(product.id, userPosts));
        const tone = matchTone(breakdown.fitMatchScore);
        return (
          <Pressable
            key={product.id}
            accessibilityRole="link"
            accessibilityLabel={`${product.name} by ${product.brand}, ${tone.label}`}
            onPress={() => {
              addSearch(query || product.name);
              router.push(`/product/${product.id}`);
            }}
          >
            <Card style={{ padding: 10, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {/* Colour rail: the fit read happens in peripheral vision. */}
                <View
                  style={{
                    position: 'absolute',
                    left: -10,
                    top: -10,
                    bottom: -10,
                    width: 4,
                    backgroundColor: tone.fg,
                  }}
                />
                <Thumb imageUrl={product.heroImageUrl} category={product.category} size={62} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Title>{product.name}</Title>
                  <Caption>{`${product.brand} · ${categoryLabel(product.category)}`}</Caption>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <View
                      style={{
                        backgroundColor: tone.bg,
                        borderRadius: radii.chip,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: tone.fg }}>
                        {tone.label}
                      </Text>
                    </View>
                    <Caption>{breakdown.fitLabel}</Caption>
                  </View>
                </View>
                <CaretRight size={14} color={colors.mist} weight="bold" />
              </View>
            </Card>
          </Pressable>
        );
      })}

      {!isFetching && !results.length ? (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
          <MagnifyingGlass size={24} color={colors.inkSoft} weight="regular" />
          <Title>Nothing matched that</Title>
          <Caption>Try an ingredient like niacinamide, or a concern like oiliness.</Caption>
        </Card>
      ) : null}
    </Screen>
  );
}
