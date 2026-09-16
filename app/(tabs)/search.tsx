import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Caption, Card, Chip, ScoreBadge, Thumb, Title } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { categoryLabel, getProductPosts, tagLabel } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { searchCatalog } from '@/lib/products';
import { BROWSE_CHIPS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';

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

  return (
    <Screen>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => {
          addSearch(query);
          track('search_submitted', { query });
        }}
        placeholder="Search products, ingredients, concerns"
        placeholderTextColor={colors.inkSoft}
        style={{
          backgroundColor: colors.white,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: radii.button,
          paddingHorizontal: 14,
          paddingVertical: 14,
          fontFamily: fonts.regular,
          color: colors.ink,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BROWSE_CHIPS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={chip === item.value}
            onPress={() => setChip((current) => (current === item.value ? undefined : item.value))}
          />
        ))}
      </View>
      <Caption>
        {isFetching
          ? 'Looking up live beauty products…'
          : `${results.length} products · Open Beauty Facts · sorted by fit`}
      </Caption>
      {isFetching ? <ActivityIndicator color={colors.rosewood} /> : null}
      {results.map((product) => {
        const breakdown = computeConfidence(product, profile, getProductPosts(product.id, userPosts));
        return (
          <Pressable
            key={product.id}
            onPress={() => {
              addSearch(query || product.name);
              router.push(`/product/${product.id}`);
            }}
          >
            <Card>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Thumb emoji={product.heroEmoji} imageUrl={product.heroImageUrl} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Title>{product.name}</Title>
                  <Caption>{`${product.brand} · ${categoryLabel(product.category)}${
                    product.attributeTags[0] ? ` · ${tagLabel(product.attributeTags[0])}` : ''
                  }`}</Caption>
                  <ScoreBadge breakdown={breakdown} />
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
