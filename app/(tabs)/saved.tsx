import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Caption, Card, Heading, SectionHeader, Thumb, Title } from '@/components/ui';
import { Bell, BellSlash, CaretRight, Heart } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { getProduct } from '@/lib/catalog';
import { useAppStore } from '@/lib/store';
import { useProducts } from '@/lib/useProduct';

/**
 * 10 — Saved & price alerts.
 *
 * The feeling is being quietly looked after between visits, which only works
 * if the app never pings without a real reason. So the alert toggle states
 * exactly what would trigger it, and we say plainly that we will not invent a
 * drop or pad the frequency to get someone opening the app more often.
 */
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

  const watching = favorites.filter((fav) => fav.priceAlertEnabled).length;

  return (
    <Screen>
      <Heading size={21}>Saved</Heading>

      {rows.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 7, paddingVertical: 30 }}>
          <Heart size={26} color={colors.inkSoft} weight="regular" />
          <Title>Nothing saved yet</Title>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12.5,
              lineHeight: 19,
              color: colors.inkSoft,
              textAlign: 'center',
              maxWidth: 280,
            }}
          >
            Tap the heart on any product. You save the product itself, not a store — so an alert follows
            the best price anywhere, not one seller.
          </Text>
        </Card>
      ) : (
        <SectionHeader
          title={`${rows.length} saved`}
          hint={
            watching
              ? `Watching ${watching} for a real price movement.`
              : 'Turn on the bell to hear about an actual price drop.'
          }
        />
      )}

      {rows.map((row) => {
        const { fav, product } = row!;
        return (
          <Pressable
            key={product.id}
            accessibilityRole="link"
            accessibilityLabel={product.name}
            onPress={() => router.push(`/product/${product.id}`)}
          >
            <Card style={{ padding: 10 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Thumb imageUrl={product.heroImageUrl} category={product.category} size={56} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Title>{product.name}</Title>
                  <Caption>{product.brand}</Caption>
                  <Caption color={fav.priceAlertEnabled ? colors.sage : colors.inkSoft}>
                    {fav.priceAlertEnabled
                      ? 'You will hear only if the price actually falls'
                      : 'No alerts on this one'}
                  </Caption>
                </View>
                <Pressable
                  onPress={() => setPriceAlert(product.id, !fav.priceAlertEnabled)}
                  hitSlop={10}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: fav.priceAlertEnabled }}
                  accessibilityLabel={`Price alerts for ${product.name}`}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: fav.priceAlertEnabled ? colors.sageSoft : colors.shell,
                  }}
                >
                  {fav.priceAlertEnabled ? (
                    <Bell size={18} color={colors.sage} weight="fill" />
                  ) : (
                    <BellSlash size={18} color={colors.inkSoft} weight="regular" />
                  )}
                </Pressable>
                <CaretRight size={13} color={colors.mist} weight="bold" />
              </View>
            </Card>
          </Pressable>
        );
      })}

      {rows.length ? (
        <Caption>
          Store prices are not connected yet. When they are, an alert fires on a genuine drop and
          nothing else — we will not simulate one or send a reminder just to get you back.
        </Caption>
      ) : null}
    </Screen>
  );
}
