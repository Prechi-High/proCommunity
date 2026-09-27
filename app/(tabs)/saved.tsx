import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { BookmarkSimple, Clock } from '@/components/icons';
import { Group, LargeTitle, PrimaryButton, ProductRow, Segmented } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import { displayName, getKnownProduct } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { Product } from '@/lib/types';

type Seg = 'saved' | 'recent';

export default function SavedScreen() {
  const router = useRouter();
  const favorites = useAppStore((s) => s.favorites);
  const recentIds = useAppStore((s) => s.recentProductIds);
  const clearRecent = useAppStore((s) => s.clearRecentProducts);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  useAppStore((s) => s.knownProducts);
  const [seg, setSeg] = useState<Seg>(favorites.length ? 'saved' : 'recent');

  const ids = seg === 'saved' ? favorites.map((f) => f.productId) : recentIds;
  const items = ids.map((id) => getKnownProduct(id)).filter(Boolean) as Product[];

  const open = (p: Product) => router.push({ pathname: '/product/[id]', params: { id: p.id, q: displayName(p) } } as Href);

  return (
    <Screen>
      <View style={{ paddingTop: 18, gap: 18 }}>
        <LargeTitle sub="Products you’re weighing up, all in one place.">Saved</LargeTitle>
        <Segmented
          options={[
            { id: 'saved', label: `Saved${favorites.length ? ` (${favorites.length})` : ''}` },
            { id: 'recent', label: 'Recently viewed' },
          ]}
          value={seg}
          onChange={setSeg}
        />

        {items.length ? (
          <>
            <Group>
              {items.map((p, i) => (
                <View key={p.id} style={{ borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
                  <ProductRow
                    product={p}
                    onPress={() => open(p)}
                    trailing={
                      seg === 'saved' ? (
                        <Pressable
                          hitSlop={10}
                          accessibilityLabel="Remove from saved"
                          onPress={() => {
                            hapticSelect();
                            toggleFavorite(p.id);
                          }}
                        >
                          <BookmarkSimple size={20} color={colors.hi} weight="fill" />
                        </Pressable>
                      ) : undefined
                    }
                  />
                </View>
              ))}
            </Group>
            {seg === 'recent' ? (
              <Pressable onPress={clearRecent} style={{ alignSelf: 'center', padding: 8 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.hi }}>Clear history</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 20 }}>
            {seg === 'saved' ? (
              <BookmarkSimple size={40} color={colors.bone3} weight="regular" />
            ) : (
              <Clock size={40} color={colors.bone3} weight="regular" />
            )}
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.bone, letterSpacing: -0.3 }}>
              {seg === 'saved' ? 'Nothing saved yet' : 'No history yet'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, color: colors.bone2, textAlign: 'center', lineHeight: 21 }}>
              {seg === 'saved'
                ? 'Tap the bookmark on any product to keep it here while you decide.'
                : 'Products you open will appear here so you can pick up where you left off.'}
            </Text>
            <PrimaryButton label="Search products" onPress={() => router.push('/(tabs)')} style={{ marginTop: 6 }} />
          </View>
        )}
      </View>
    </Screen>
  );
}
