import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import {
  AppShell,
  SearchField,
  FilterChips,
  ActionButton,
  EmptyState,
  StatusMessage,
} from "@/components/unmask-ui";
import { OfferCard } from "@/components/unmask-ui/OfferCard";
import { DemoBanner } from "@/components/unmask-ui/DemoBanner";
import { useOffers } from "@/lib/unmask/offers";
import { colors, fonts } from "@/constants/theme";
export default function Offers() {
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All");
  const q = useOffers();
  const rows = q.rows.filter(
    (o) =>
      (category === "All" || o.unmask_catalog?.category === category) &&
      `${o.title} ${o.sponsor} ${o.unmask_catalog?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <AppShell
      back
      navigation
      title="Find a good deal. Know what you’re buying."
      serif
      subtitle="Products from sellers. Context from the community."
    >
      <DemoBanner />
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Find an offer or product"
      />
      <FilterChips
        options={[
          "All",
          ...new Set(
            q.rows
              .map((o) => o.unmask_catalog?.category)
              .filter((x): x is string => !!x),
          ),
        ]}
        value={category}
        onChange={setCategory}
      />
      {q.isLoading ? <ContentSkeleton /> : null}
      {q.error ? (
        <ActionButton label="Retry offers" tone="secondary" onPress={q.retry} />
      ) : null}
      {q.countError && !q.demo ? (
        <StatusMessage
          title="Experience counts are temporarily unavailable."
          detail="You can still open a product and read its conversations."
        />
      ) : null}
      <View style={{ gap: 20, flexDirection: "row", flexWrap: "wrap" }}>
        {rows.map((o) => (
          <View key={o.id} style={{ width: width >= 700 ? "48%" : "100%" }}>
            <OfferCard offer={o} />
          </View>
        ))}
      </View>
      {!q.isLoading && !q.error && !rows.length ? (
        <EmptyState
          title="No offers match yet."
          detail="Try another product or check back for new sellers."
        />
      ) : null}
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 12,
          lineHeight: 18,
          color: colors.inkSoft,
        }}
      >
        An offer is a seller’s promotion, not an Unmask endorsement. Read
        experiences or ask the community before you decide.
      </Text>
    </AppShell>
  );
}
