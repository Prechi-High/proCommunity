import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Badge, Button, Caption, Heading, Notice, ScoreBadge, Thumb, Title } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { getProduct, getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { useAppStore } from '@/lib/store';

export default function SatchelScreen() {
  const router = useRouter();
  const items = useAppStore((state) => state.satchelItems);
  const profile = useAppStore((state) => state.profile);
  const userPosts = useAppStore((state) => state.userPosts);
  const markSatchelPurchased = useAppStore((state) => state.markSatchelPurchased);
  const removeFromSatchel = useAppStore((state) => state.removeFromSatchel);
  const open = items.filter((item) => !item.purchased);
  const firstOpen = open[0];

  return (
    <Screen
      footer={
        firstOpen ? (
          <Button
            label="Ready to buy"
            onPress={() => router.push(`/product/${firstOpen.productId}/stores`)}
          />
        ) : undefined
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: colors.ink }}>←</Text>
        </Pressable>
        <Heading size={16}>Your Satchel</Heading>
      </View>
      <Caption>
        {items.length
          ? `${items.length} ${items.length === 1 ? 'product' : 'products'} collected`
          : 'Collect products while you keep browsing. Nothing here is a purchase.'}
      </Caption>

      {items.map((item) => {
        const product = getProduct(item.productId);
        const name = product?.name ?? 'Saved product';
        const breakdown = product
          ? computeConfidence(product, profile, getProductPosts(product.id, userPosts))
          : null;
        return (
          <View
            key={item.id}
            style={{
              backgroundColor: colors.white,
              borderColor: colors.mist,
              borderWidth: 1,
              borderRadius: 12,
              padding: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Thumb emoji={product?.heroEmoji ?? '👜'} imageUrl={product?.heroImageUrl} size={44} />
            <Pressable
              style={{ flex: 1, gap: 6 }}
              onPress={() => router.push(`/product/${item.productId}`)}
            >
              <Title>{name}</Title>
              {breakdown ? <ScoreBadge breakdown={breakdown} /> : <Caption>Open to see details</Caption>}
            </Pressable>
            <Pressable
              onPress={() => markSatchelPurchased(item.productId)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: item.purchased ? colors.sage : colors.mist,
                backgroundColor: item.purchased ? colors.sage : colors.white,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Mark as bought"
            >
              {item.purchased ? (
                <Text style={{ color: colors.white, fontFamily: fonts.bold, fontSize: 12 }}>✓</Text>
              ) : null}
            </Pressable>
          </View>
        );
      })}

      {items.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {open.map((item) => (
            <Pressable key={`buy-${item.id}`} onPress={() => router.push(`/product/${item.productId}/stores`)}>
              <Badge label={`Get ${getProduct(item.productId)?.name.split(' ')[0] ?? 'this'}`} tone="rose" />
            </Pressable>
          ))}
          {items.map((item) => (
            <Pressable key={`rm-${item.id}`} onPress={() => removeFromSatchel(item.productId)}>
              <Badge label="Remove" />
            </Pressable>
          ))}
        </View>
      ) : (
        <Button label="Find a product" onPress={() => router.push('/(tabs)/search')} />
      )}

      <Notice quiet>
        V2: we will show which store carries the most of your Satchel. Checking an item off logs a purchase for
        verified-owner eligibility — it never creates checkout pressure.
      </Notice>
    </Screen>
  );
}
