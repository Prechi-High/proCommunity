import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, BellSlash } from 'phosphor-react-native';

import { Screen } from '@/components/Screen';
import { Caption, Card, Heading, Thumb, Title } from '@/components/ui';
import { colors } from '@/constants/theme';
import { getProduct } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';
import { useProducts } from '@/lib/useProduct';

export default function SavedScreen() {
  const router = useRouter();
  const favorites = useAppStore((s) => s.favorites);
  const setPriceAlert = useAppStore((s) => s.setPriceAlert);
  useProducts(favorites.map((fav) => fav.productId));

  const rows = favorites
    .map((fav) => {
      const product = getProduct(fav.productId);
      if (!product) return null;
      return { fav, product };
    })
    .filter(Boolean);

  return (
    <Screen>
      <Heading size={21}>Saved</Heading>
      <Caption>
        {rows.length === 0
          ? 'Save a product from its page. You favorite the product itself, not a store.'
          : `${rows.length} products · store price alerts return when listings are live`}
      </Caption>
      {rows.map((row) => {
        const { fav, product } = row!;
        return (
          <Pressable key={product.id} onPress={() => router.push(`/product/${product.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Thumb emoji={product.heroEmoji} imageUrl={product.heroImageUrl} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Title>{product.name}</Title>
                  <Caption>{`${product.brand} · ${product.source === 'open_beauty_facts' ? 'Open Beauty Facts' : 'Catalog'}`}</Caption>
                </View>
                <Pressable onPress={() => setPriceAlert(product.id, !fav.priceAlertEnabled)} hitSlop={8}>
                  {fav.priceAlertEnabled ? (
                    <Bell size={20} color={colors.ink} weight="fill" />
                  ) : (
                    <BellSlash size={20} color={colors.mist} />
                  )}
                </Pressable>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
