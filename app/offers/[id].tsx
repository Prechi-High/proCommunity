import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { OfferCard } from "@/components/unmask-ui/OfferCard";
import { useOffers, type DisplayOffer } from "@/lib/unmask/offers";
import * as api from "@/lib/team/api";
import { db } from "@/lib/clarity/api";
import { safeLink } from "@/lib/profiles/api";
import { colors, fonts } from "@/constants/theme";
export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const offers = useOffers();
  const sample = id?.startsWith("sample-");
  const [showTerms, setShowTerms] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["offers", "detail", id],
    queryFn: () => api.offer(id),
    enabled: !!id && !sample,
  });
  const count = useQuery({
    queryKey: ["offer-evidence", q.data?.product_id],
    enabled: !!q.data,
    queryFn: async () => {
      const { count, error } = await db()
        .from("clarity_experiences")
        .select("id", { count: "exact", head: true })
        .eq("product_id", q.data!.product_id)
        .eq("visibility", "public")
        .eq("moderation_status", "visible");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const o: DisplayOffer | undefined = sample
    ? offers.rows.find((x) => x.id === id)
    : q.data
      ? { ...q.data, experience_count: count.data }
      : undefined;
  const url = q.data?.store_url && safeLink(q.data.store_url);
  return (
    <AppShell
      back
      navigation
      title="The offer, in full."
      subtitle="Read the experience. Then decide."
    >
      {(!sample && q.isLoading) || (sample && offers.isLoading) ? (
        <ContentSkeleton />
      ) : null}
      {(!sample && q.isError) || (sample && !o) ? (
        <StatusMessage kind="error" title="This offer isn’t available." />
      ) : null}
      {o ? (
        <>
          <OfferCard offer={o} />
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 15,
              lineHeight: 23,
              color: colors.ink,
            }}
          >
            {o.description}
          </Text>
          {sample ? (
            <StatusMessage
              title="Demo offer"
              detail="Prices and promotions are fictional. There is no checkout for this example."
            />
          ) : null}
          {count.isError && !sample ? (
            <StatusMessage
              title="Experience count couldn’t load."
              detail="Open the product to explore its conversations."
            />
          ) : null}
          {url ? (
            <ActionButton
              label={`Visit ${o.sponsor}`}
              tone="secondary"
              onPress={() => setLeaving(true)}
            />
          ) : null}
          <ActionButton
            tone="ghost"
            label={showTerms ? "Hide offer terms" : "Offer terms"}
            onPress={() => setShowTerms((x) => !x)}
          />
          {showTerms ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 14,
                lineHeight: 21,
                color: colors.inkSoft,
              }}
            >
              {sample
                ? "Demo only. No purchase available."
                : q.data?.terms ||
                  "Check availability, delivery and returns with the seller."}
            </Text>
          ) : null}
          {leaving && url ? (
            <View
              style={{
                padding: 18,
                borderRadius: 18,
                backgroundColor: "#F7F0E9",
                gap: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 17,
                  color: colors.ink,
                }}
              >
                Continue to the seller?
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 14,
                  lineHeight: 21,
                  color: colors.inkSoft,
                }}
              >
                You’ll leave Unmask. The seller handles payment, delivery and
                returns.
              </Text>
              <ActionButton
                label="Continue to store"
                onPress={() =>
                  void Linking.openURL(url).catch(() =>
                    setError("The store couldn’t open."),
                  )
                }
              />
              <ActionButton
                tone="ghost"
                label="Stay here"
                onPress={() => setLeaving(false)}
              />
            </View>
          ) : null}
        </>
      ) : null}
      {error ? <StatusMessage kind="error" title={error} /> : null}
    </AppShell>
  );
}
