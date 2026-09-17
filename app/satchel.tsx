import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Button, Caption, Card, Check, Heading, Notice, ScoreBadge, Thumb, Title } from '@/components/ui';
import { BackButton, Cat, MagnifyingGlass, Storefront, Trash } from '@/components/icons';
import { colors, elevation, fonts, radii } from '@/constants/theme';
import { getProduct, getProductPosts } from '@/lib/catalog';
import { computeConfidence } from '@/lib/confidence';
import { useAppStore } from '@/lib/store';

/**
 * 09b — The Satchel.
 *
 * This exists to remove the anxiety of "decide now or lose track of it", so
 * every word on the screen has to stay on the right side of that line: nothing
 * expires, nothing is counting down, and checking an item off is a record of
 * something you already did rather than a prompt to go do it. The mascot is
 * here because a little delight makes browsing feel lighter — and it is
 * attached to a genuinely useful function, not to a dark pattern.
 */
export default function SatchelScreen() {
  const router = useRouter();
  const items = useAppStore((state) => state.satchelItems);
  const profile = useAppStore((state) => state.profile);
  const userPosts = useAppStore((state) => state.userPosts);
  const markSatchelPurchased = useAppStore((state) => state.markSatchelPurchased);
  const removeFromSatchel = useAppStore((state) => state.removeFromSatchel);
  const open = items.filter((item) => !item.purchased);
  const bought = items.filter((item) => item.purchased);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Heading size={19}>Your Satchel</Heading>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 34 }}>
          <View
            style={{
              width: 82,
              height: 82,
              borderRadius: 41,
              backgroundColor: colors.rosewoodSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cat size={40} color={colors.rosewood} weight="fill" />
          </View>
          <Heading size={18}>Nothing in the bag yet</Heading>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              lineHeight: 20,
              color: colors.inkSoft,
              textAlign: 'center',
              maxWidth: 290,
            }}
          >
            Drop anything you're still thinking about in here and keep browsing. It will be waiting
            whenever you come back — there is no timer on it.
          </Text>
          <Button
            label="Find something"
            icon={MagnifyingGlass}
            onPress={() => router.push('/(tabs)/search')}
            style={{ marginTop: 6, alignSelf: 'stretch' }}
          />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.rosewoodSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cat size={18} color={colors.rosewood} weight="fill" />
            </View>
            <Caption>
              {`${open.length} still thinking about${bought.length ? `, ${bought.length} already bought` : ''}. Nothing here expires.`}
            </Caption>
          </View>

          {items.map((item) => {
            const product = getProduct(item.productId);
            const breakdown = product
              ? computeConfidence(product, profile, getProductPosts(product.id, userPosts))
              : null;
            return (
              <View
                key={item.id}
                style={[
                  {
                    backgroundColor: colors.white,
                    borderColor: colors.mist,
                    borderWidth: 1,
                    borderRadius: radii.card,
                    padding: 10,
                    gap: 10,
                    opacity: item.purchased ? 0.72 : 1,
                  },
                  elevation.raised,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Thumb
                    imageUrl={product?.heroImageUrl}
                    category={product?.category}
                    size={52}
                  />
                  <Pressable
                    style={{ flex: 1, gap: 5 }}
                    onPress={() => router.push(`/product/${item.productId}`)}
                  >
                    <Title>{product?.name ?? 'Saved product'}</Title>
                    {breakdown ? (
                      <ScoreBadge breakdown={breakdown} />
                    ) : (
                      <Caption>Open to see the details</Caption>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => markSatchelPurchased(item.productId)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={item.purchased ? 'Marked as bought' : 'Mark as bought'}
                  >
                    <Check done={item.purchased} size={26} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {!item.purchased ? (
                    <Pressable
                      onPress={() => router.push(`/product/${item.productId}/stores`)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: colors.rosewoodSoft,
                        borderRadius: radii.chip,
                        paddingHorizontal: 11,
                        paddingVertical: 6,
                      }}
                    >
                      <Storefront size={13} color={colors.rosewood} weight="regular" />
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.rosewood }}>
                        Where to buy
                      </Text>
                    </Pressable>
                  ) : (
                    <Caption color={colors.sage}>Bought — you can post as a verified owner</Caption>
                  )}
                  <View style={{ flex: 1 }} />
                  <Pressable
                    onPress={() => removeFromSatchel(item.productId)}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${product?.name ?? 'item'} from Satchel`}
                  >
                    <Trash size={15} color={colors.inkSoft} weight="regular" />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </>
      )}

      <Notice quiet>
        Ticking something off records that you bought it, which is what makes your posts show as a
        verified owner. It is a record, not a reminder — we will never chase you to finish.
      </Notice>
    </Screen>
  );
}
