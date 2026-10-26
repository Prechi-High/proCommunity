import { ContentSkeleton } from "./Skeleton";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, Storefront } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { useOffers } from "@/lib/unmask/offers";
import { OfferCard } from "./OfferCard";
export function OffersSpotlight() {
  const r = useRouter();
  const q = useOffers();
  return (
    <View style={{ paddingVertical: 22, backgroundColor: "#F8F2E9", gap: 16 }}>
      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Storefront size={24} color={colors.brand} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.semibold,
              fontSize: 21,
              color: colors.ink,
            }}
          >
            Offers from independent sellers
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12,
              color: colors.inkSoft,
            }}
          >
            Sponsored by external sellers. Unmask before you buy.
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="See all offers"
          onPress={() => r.push("/offers")}
          style={{ padding: 10 }}
        >
          <ArrowRight size={22} color={colors.brand} />
        </Pressable>
      </View>
      {q.isLoading ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ContentSkeleton rows={2} />
        </View>
      ) : q.rows.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        >
          {q.rows.slice(0, 6).map((o) => (
            <OfferCard key={o.id} offer={o} compact />
          ))}
        </ScrollView>
      ) : (
        <Pressable
          accessibilityRole="link"
          onPress={() => (q.error ? q.retry() : r.push("/offers"))}
          style={{
            marginHorizontal: 20,
            padding: 18,
            borderRadius: 16,
            backgroundColor: "#fff",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: colors.inkSoft,
            }}
          >
            {q.isLoading
              ? "Finding current offers…"
              : q.error
                ? "Offers couldn’t load. Tap to retry."
                : "New seller offers will appear here. Explore offers."}
          </Text>
        </Pressable>
      )}
      <Text
        style={{
          paddingHorizontal: 20,
          fontFamily: fonts.regular,
          fontSize: 11,
          lineHeight: 17,
          color: colors.inkSoft,
        }}
      >
        {q.demo ? "Fictional demo offers. " : ""}Seller placement supports
        Unmask. Experiences stay independent.
      </Text>
    </View>
  );
}
