import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Heading, Notice, Title } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { useProduct } from '@/lib/useProduct';

export default function StoresScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = routeId(rawId);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.rosewood} />
      </Screen>
    );
  }

  if (!product) return null;

  const openFactsUrl = product.productUrl ?? (product.barcode
    ? `https://world.openbeautyfacts.org/product/${product.barcode}`
    : null);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <Heading size={16}>Where to buy</Heading>
      </View>
      <Caption>{product.name}</Caption>
      <Notice>
        Store prices are not live yet. Shopify checkout is paused — we will not invent Naira prices.
      </Notice>
      {openFactsUrl ? (
        <Pressable
          onPress={() => Linking.openURL(openFactsUrl)}
          style={{
            backgroundColor: colors.white,
            borderColor: colors.mist,
            borderWidth: 1,
            borderRadius: radii.card,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.mist,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text>🧴</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Title>Open Beauty Facts</Title>
            <Caption>Product page, ingredients, and community photos</Caption>
          </View>
          <Text style={{ fontFamily: fonts.semibold, color: colors.rosewood }}>Open</Text>
        </Pressable>
      ) : (
        <Caption>No merchant link is available for this product yet.</Caption>
      )}
      <Notice quiet>When stores are added, they will be ranked by your filter only. No store can pay to appear higher.</Notice>
      <Button label="↑ Back to reviews & ingredients" kind="text" onPress={() => router.back()} />
    </Screen>
  );
}
