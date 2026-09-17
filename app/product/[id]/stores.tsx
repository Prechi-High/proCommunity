import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Caption, Card, Heading, Notice, Thumb, Title } from '@/components/ui';
import { ArrowSquareOut, BackButton, Handbag, Scales, Storefront } from '@/components/icons';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { routeId } from '@/lib/catalog';
import { useProduct } from '@/lib/useProduct';

/**
 * 05 — Store list.
 *
 * By the time someone is here the decision is already made emotionally; this
 * screen just has to not undo it. The fairness statement is placed above the
 * list rather than buried below it, because naming the absence of manipulation
 * is what actually lowers reactance. There is no stock or price urgency
 * anywhere on this screen, because we have no real data to support any.
 */
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

  const openFactsUrl =
    product.productUrl ??
    (product.barcode ? `https://world.openbeautyfacts.org/product/${product.barcode}` : null);

  const openInApp = (url: string) => {
    track('store_clickthrough', { productId: product.id, url });
    router.push(
      `/browse?url=${encodeURIComponent(url)}&host=${encodeURIComponent(hostFrom(url))}` as Href,
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Heading size={18}>Where to buy</Heading>
        </View>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
        <Thumb imageUrl={product.heroImageUrl} category={product.category} size={48} />
        <View style={{ flex: 1 }}>
          <Title>{product.name}</Title>
          <Caption>{product.brand}</Caption>
        </View>
      </Card>

      {/* Said out loud, and said first. */}
      <View
        style={{
          flexDirection: 'row',
          gap: 11,
          alignItems: 'flex-start',
          backgroundColor: colors.sageSoft,
          borderRadius: radii.card,
          padding: 13,
        }}
      >
        <Scales size={16} color={colors.sage} weight="fill" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink }}>
            No store paid to be here
          </Text>
          <Caption>
            This order is not for sale. We take nothing from the seller, so nobody can buy a higher
            position on this page.
          </Caption>
        </View>
      </View>

      {openFactsUrl ? (
        <Pressable
          onPress={() => openInApp(openFactsUrl)}
          style={[
            {
              backgroundColor: colors.white,
              borderColor: colors.mist,
              borderWidth: 1,
              borderRadius: radii.card,
              padding: 13,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            },
            elevation.raised,
          ]}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.rosewoodSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Storefront size={19} color={colors.rosewood} weight="regular" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Title>Open Beauty Facts</Title>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Handbag size={11} color={colors.inkSoft} weight="regular" />
              <Caption>Opens inside Sourced — your Satchel comes with you</Caption>
            </View>
          </View>
          <ArrowSquareOut size={16} color={colors.rosewood} weight="regular" />
        </Pressable>
      ) : (
        <Notice quiet>
          No merchant link exists for this product yet. We would rather show nothing than invent a
          listing.
        </Notice>
      )}

      <Notice quiet>
        Live prices and stock are not connected yet. When they are, they will come from the store's own
        feed — we will not estimate a price or imply something is running out.
      </Notice>
    </Screen>
  );
}

function hostFrom(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'store';
  }
}
