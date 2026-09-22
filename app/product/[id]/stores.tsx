import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Caption, Chip, Heading } from '@/components/ui';
import { BackButton } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { getListingsForProduct, routeId } from '@/lib/catalog';
import { hapticSelect } from '@/lib/haptics';
import { useProduct } from '@/lib/useProduct';

type Filter = 'price' | 'ships' | 'stock';

/**
 * Where to buy — store rows + fairness line from sourced-v1 (2).html.
 */
export default function StoresScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product } = useProduct(id);
  const [filter, setFilter] = useState<Filter>('price');

  const listings = useMemo(() => {
    const raw = getListingsForProduct(id);
    const list = [...raw];
    if (filter === 'price') list.sort((a, b) => a.price - b.price);
    if (filter === 'stock') list.sort((a, b) => Number(b.inStock) - Number(a.inStock));
    return list;
  }, [id, filter]);

  const lowest = listings.filter((l) => l.inStock).sort((a, b) => a.price - b.price)[0]?.id;

  if (!product) return null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <Heading size={18}>Where to buy</Heading>
      </View>
      <Caption>
        {product.name} · {listings.length} stores
      </Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
        <Chip label="Price, low to high" selected={filter === 'price'} onPress={() => setFilter('price')} />
        <Chip label="Ships to me" selected={filter === 'ships'} onPress={() => setFilter('ships')} />
        <Chip label="In stock" selected={filter === 'stock'} onPress={() => setFilter('stock')} />
      </View>

      {listings.length === 0 ? (
        <Caption>No merchant listings for this product yet.</Caption>
      ) : (
        listings.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => {
              hapticSelect();
              router.push(
                `/browse?url=${encodeURIComponent(s.productUrl)}&host=${encodeURIComponent(s.merchantName)}` as Href,
              );
            }}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.bone }}>{s.merchantName}</Text>
              <Caption>{s.shipsNote}</Caption>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  fontWeight: '500',
                  color: s.inStock ? colors.bone : colors.bone3,
                }}
              >
                ₦{s.price.toLocaleString()}
              </Text>
              {s.id === lowest ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.sage }}>Lowest price</Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}

      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 }}>
        <Caption>
          Sorted by your filter only. No store can pay to appear higher. You don’t have to buy it just because
          you found it.
        </Caption>
      </View>
    </Screen>
  );
}
