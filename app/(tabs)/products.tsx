import { Lock } from "@/components/icons";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import {
  ActionButton,
  AppShell,
  EmptyState,
  FilterChips,
  MediaFrame,
  StatusMessage,
  StorySkeleton,
  SearchField,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import { displayName } from "@/lib/products";
import { useAppStore } from "@/lib/store";

export default function MyProducts() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [tab, setTab] = useState("I use");
  const [search, setSearch] = useState("");
  const saved = useAppStore((s) => s.favorites);
  const known = useAppStore((s) => s.knownProducts);

  const journeys = useQuery({
    queryKey: ["living", "journeys", uid],
    queryFn: living.journeys,
    enabled: !!uid,
  });
  const experiences = useQuery({
    queryKey: ["my-clarity-experiences", uid],
    queryFn: () => clarity.experiences(true),
    enabled: !!uid,
  });
  const subs = useQuery({
    queryKey: ["living", "subscriptions", uid],
    queryFn: living.subscriptions,
    enabled: !!uid,
  });
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });

  const useRows = useMemo(() => {
    const fromJ = (journeys.data ?? []).map((j) => ({
      id: j.product_id,
      name: j.unmask_catalog?.name || j.product_id,
      brand: j.unmask_catalog?.brand,
      image: j.unmask_catalog?.image_url,
      note: j.goal || "Private timeline",
      href: j.id ? `/journey/${j.id}` : `/product/${j.product_id}`,
    }));
    const extra = (experiences.data ?? [])
      .filter((e) => !fromJ.some((r) => r.id === e.product_id))
      .map((e) => ({
        id: e.product_id,
        name: e.unmask_catalog?.name || e.product_id,
        brand: e.unmask_catalog?.brand,
        image: e.unmask_catalog?.image_url,
        note: e.body.slice(0, 80),
        href: `/contribute?experience=${e.id}&update=1`,
      }));
    return [...fromJ, ...extra];
  }, [experiences.data, journeys.data]);

  const following = (subs.data ?? [])
    .filter((s) => s.target_type === "product")
    .map((s) => {
      const p = catalog.data?.find((x) => x.id === s.target_id);
      return {
        id: s.target_id,
        name: p?.name || known[s.target_id]?.name || s.target_id,
        brand: p?.brand,
        image: p?.image_url,
        note: "Following",
        href: `/product/${s.target_id}`,
      };
    });

  const favorites = saved.map((s) => ({
    id: s.productId,
    name: known[s.productId] ? displayName(known[s.productId]) : s.productId,
    brand: known[s.productId]?.brand,
    image: known[s.productId]?.heroImageUrl,
    note: "Saved",
    href: `/product/${s.productId}`,
  }));

  const liveRows =
    tab === "I use" ? useRows : tab === "Following" ? following : favorites;
  const rows = liveRows.filter((p) =>
    `${p.name} ${p.brand ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell
      title="Your product story, over time."
      serif
      notify
      subtitle={COPY.productTabSubtitle}
    >
      <View
        style={{
          padding: 20,
          borderRadius: 22,
          backgroundColor: "#F2EAE3",
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Lock size={20} color={colors.brand} />
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 14,
              color: colors.brand,
            }}
          >
            A private place to notice the difference.
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            lineHeight: 23,
            color: colors.inkSoft,
          }}
        >
          Day one. Week six. Still using it? Add a photo or a note. Your updates
          can help someone else when you choose to share.
        </Text>
      </View>
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Find a product on your shelf"
      />
      <FilterChips
        options={["I use", "Following", "Saved"]}
        value={tab}
        onChange={setTab}
      />
      {journeys.isError || experiences.isError || subs.isError ? (
        <StatusMessage
          kind="error"
          title="Some of your products couldn’t load."
          detail="Refresh before adding the same product again."
        />
      ) : null}
      {uid &&
      (journeys.isLoading || experiences.isLoading || subs.isLoading) ? (
        <StorySkeleton />
      ) : rows.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {rows.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push(p.href as Href)}
              style={{ width: "47%", gap: 10, paddingBottom: 8 }}
            >
              <MediaFrame
                uri={p.image}
                label={p.name}
                ratio={1}
                corners={false}
              />
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                  lineHeight: 18,
                  color: colors.ink,
                }}
              >
                {p.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 12,
                  color: colors.inkSoft,
                }}
              >
                {p.brand ? `${p.brand} · ` : ""}
                {COPY.addUpdate}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title={
            tab === "I use" ? "Nothing on your shelf yet." : "Nothing here yet."
          }
          detail="Track how you use it. Week one, month three. Share only if you choose."
          action={COPY.createTrack}
          onAction={() => router.push("/products/add" as Href)}
        />
      )}
      {rows.length ? (
        <ActionButton
          label="Track another product"
          onPress={() => router.push("/products/add" as Href)}
        />
      ) : null}
    </AppShell>
  );
}
