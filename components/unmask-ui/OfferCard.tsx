import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Storefront, ChatCircle, ArrowRight, Tag } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { MediaFrame } from "./MediaFrame";
import {
  offerDiscount,
  offerMoney,
  type DisplayOffer,
} from "@/lib/unmask/offers";
export function OfferCard({
  offer: o,
  compact = false,
}: {
  offer: DisplayOffer;
  compact?: boolean;
}) {
  const r = useRouter();
  const discount = offerDiscount(o.price, o.compare_at_price);
  const n = o.experience_count;
  const read = () =>
    r.push(
      (n === 0
        ? `/product/${o.product_id}/ask-community`
        : `/product/${o.product_id}`) as Href,
    );
  return (
    <View
      style={{
        width: compact ? 260 : "100%",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E7DDD5",
        borderRadius: 24,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Offer: ${o.title}`}
        onPress={() => r.push(`/offers/${o.id}` as Href)}
      >
        <MediaFrame
          uri={o.unmask_catalog?.image_url}
          label={o.unmask_catalog?.name || o.title}
          ratio={compact ? 1.8 : 1.65}
          corners={false}
        />
        <View
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: discount ? "#F2D25B" : "#FFFFFFE8",
          }}
        >
          <Tag size={13} color={colors.brand} />
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 11,
              color: colors.brand,
            }}
          >
            {discount
              ? `${discount}% off`
              : o.sample
                ? "Demo offer"
                : "Seller offer"}
          </Text>
        </View>
      </Pressable>
      <View style={{ padding: compact ? 16 : 20, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Storefront size={14} color={colors.inkSoft} />
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.medium,
              fontSize: 11,
              color: colors.inkSoft,
              flex: 1,
            }}
          >
            {o.sponsor}
            {o.sample ? " · Demo" : " · Sponsored"}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.semibold,
            fontSize: compact ? 17 : 22,
            lineHeight: compact ? 23 : 28,
            color: colors.ink,
          }}
        >
          {o.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.regular,
            fontSize: 12,
            color: colors.inkSoft,
          }}
        >
          {o.unmask_catalog?.name}
        </Text>
        {o.price != null ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: compact ? 22 : 28,
                color: colors.brand,
              }}
            >
              {offerMoney(o.price, o.currency)}
            </Text>
            {discount > 0 && o.compare_at_price != null ? (
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: colors.inkSoft,
                  textDecorationLine: "line-through",
                }}
              >
                {offerMoney(o.compare_at_price, o.currency)}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 13,
              color: colors.inkSoft,
            }}
          >
            See seller’s current price
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            n === 0
              ? "Ask the community before buying"
              : `Unmask product${n !== undefined ? `, ${n} experiences` : ""}`
          }
          onPress={read}
          style={({ pressed }) => ({
            paddingVertical: 13,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: pressed ? "#632538" : colors.brandDeep,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          })}
        >
          <ChatCircle size={19} color="#fff" />
          <Text
            style={{
              fontFamily: fonts.semibold,
              color: "#fff",
              fontSize: 12,
              flex: 1,
            }}
          >
            {n === 0
              ? "Ask before you buy"
              : n === undefined
                ? "Unmask this product"
                : `Read ${n} experience${n === 1 ? "" : "s"}`}
          </Text>
          <ArrowRight size={16} color="#fff" />
        </Pressable>
        {!compact ? (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12,
              lineHeight: 18,
              color: colors.inkSoft,
            }}
          >
            {o.disclosure}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
