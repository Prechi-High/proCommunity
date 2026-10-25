import { useAppStore } from "@/lib/store";
import { DemoBanner } from "@/components/unmask-ui/DemoBanner";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import {
  ActionButton,
  AppShell,
  EmptyState,
  FilterChips,
  MediaFrame,
  SearchField,
  StatusMessage,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import { db } from "@/lib/clarity/api";
import { SAMPLE_OFFERS } from "@/lib/unmask/samples";
import * as api from "@/lib/team/api";

export default function Offers() {
  const router = useRouter();
  const demo = useAppStore((s) => s.demoCommunity);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const q = useQuery({
    queryKey: ["offers", "public"],
    queryFn: () => api.offers(),
  });
  const ids = [...new Set((q.data ?? []).map((o) => o.product_id))].sort();
  const counts = useQuery({
    queryKey: ["offer-counts", ids],
    enabled: ids.length > 0,
    queryFn: () =>
      api.read<{ product_id: string; experience_count: number }[]>(
        db().rpc("unmask_offer_evidence_counts", { p_ids: ids }),
      ),
  });
  const live = (q.data ?? []).filter(
    (o) =>
      (category === "All" || o.unmask_catalog?.category === category) &&
      `${o.sponsor} ${o.title} ${o.unmask_catalog?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const preview = demo;
  const samples = SAMPLE_OFFERS.filter(
    (o) =>
      (category === "All" || o.unmask_catalog.category === category) &&
      `${o.sponsor} ${o.title} ${o.unmask_catalog.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const cats = [
    "All",
    ...new Set(
      (preview
        ? SAMPLE_OFFERS.map((o) => o.unmask_catalog.category)
        : (q.data ?? []).map((o) => o.unmask_catalog?.category)
      ).filter((c): c is string => !!c),
    ),
  ];

  return (
    <AppShell back title={COPY.offersTitle} subtitle={COPY.offersHook}>
      <DemoBanner />
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Find an offer or a product"
      />
      <FilterChips options={cats} value={category} onChange={setCategory} />
      {preview ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            lineHeight: 18,
            color: colors.inkSoft,
          }}
        >
          Preview offers · labeled samples. Unmask the product before you visit
          a store.
        </Text>
      ) : null}
      {!demo && q.isError ? (
        <StatusMessage
          kind="error"
          title="Offers didn’t load."
          detail="You can still search a product."
        />
      ) : null}
      {preview
        ? samples.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => router.push(`/offers/${o.id}` as Href)}
              style={{ gap: 12, paddingBottom: 8 }}
            >
              <MediaFrame
                uri={o.unmask_catalog.image_url}
                label={o.unmask_catalog.name}
                overlay
              />
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: colors.inkSoft,
                }}
              >
                {o.kind} · {o.sponsor} · Sample
              </Text>
              <Text
                style={{
                  fontFamily: fonts.serifBold,
                  fontSize: 22,
                  lineHeight: 26,
                  color: colors.ink,
                  letterSpacing: -0.4,
                }}
              >
                {o.unmask_catalog.name}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 15,
                  lineHeight: 22,
                  color: colors.ink,
                }}
              >
                {o.title}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.inkSoft,
                }}
              >
                {o.experience_count} lived stories · {o.disclosure}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 15,
                  color: colors.brandDeep,
                }}
              >
                Unmask this product →
              </Text>
            </Pressable>
          ))
        : live.map((o) => {
            const n =
              counts.data?.find((c) => c.product_id === o.product_id)
                ?.experience_count ?? 0;
            return (
              <View key={o.id} style={{ gap: 12, paddingBottom: 8 }}>
                <MediaFrame
                  uri={o.unmask_catalog?.image_url}
                  label={o.unmask_catalog?.name || o.title}
                  overlay
                />
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 13,
                    color: colors.inkSoft,
                  }}
                >
                  {o.kind} · {o.sponsor}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.serifBold,
                    fontSize: 22,
                    lineHeight: 26,
                    color: colors.ink,
                    letterSpacing: -0.4,
                  }}
                >
                  {o.unmask_catalog?.name || o.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 15,
                    lineHeight: 22,
                    color: colors.ink,
                  }}
                >
                  {o.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 13,
                    lineHeight: 18,
                    color: colors.inkSoft,
                  }}
                >
                  {n} lived stories · {o.disclosure}
                </Text>
                <ActionButton
                  tone="secondary"
                  label="Unmask this product"
                  onPress={() =>
                    router.push(`/product/${o.product_id}` as Href)
                  }
                />
                <ActionButton
                  tone="ghost"
                  label="Offer details"
                  onPress={() => router.push(`/offers/${o.id}` as Href)}
                />
              </View>
            );
          })}
      {!preview && live.length === 0 && !q.isLoading ? (
        <EmptyState
          title={COPY.offersEmpty}
          action="Find a product"
          onAction={() => router.push("/results" as Href)}
        />
      ) : null}
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 13,
          lineHeight: 18,
          color: colors.inkSoft,
        }}
      >
        We are not pushing you to buy. Unmask first. Paid placement does not buy
        a finding.
      </Text>
    </AppShell>
  );
}
