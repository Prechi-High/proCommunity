import { DemoBanner } from "@/components/unmask-ui/DemoBanner";
import { SAMPLE_SHELF } from "@/lib/unmask/samples";
import { LinearGradient } from "expo-linear-gradient";
import { hapticSelect } from "@/lib/haptics";
import { Plus, ArrowRight, Clock, Camera, Lock } from "@/components/icons";
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
import { statusNames } from "@/components/tracking/Fields";
import type { TrackedJourney } from "@/lib/tracking/api";
import { displayName } from "@/lib/products";
import { useAppStore } from "@/lib/store";

export default function MyProducts() {
  const router = useRouter();
  const demo = useAppStore((s) => s.demoCommunity);
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
      note:
        [(j as TrackedJourney).usage_duration, j.frequency]
          .filter(Boolean)
          .join(" · ") || "Your timeline is ready",
      status: statusNames[j.status] || j.status,
      visibility: j.visibility,
      journeyId: j.id,
      verified: (j as TrackedJourney).ownership_verified,
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
        href: `/products/experience/${e.id}`,
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
        href: journeys.data?.find((j) => j.product_id === s.target_id)?.id
          ? `/journey/${journeys.data.find((j) => j.product_id === s.target_id)!.id}`
          : `/products/item/${s.target_id}`,
      };
    });

  const favorites = saved.map((s) => ({
    id: s.productId,
    name: known[s.productId] ? displayName(known[s.productId]) : s.productId,
    brand: known[s.productId]?.brand,
    image: known[s.productId]?.heroImageUrl,
    note: "Saved",
    href: journeys.data?.find((j) => j.product_id === s.productId)?.id
      ? `/journey/${journeys.data.find((j) => j.product_id === s.productId)!.id}`
      : `/products/item/${s.productId}`,
  }));

  const liveRows =
    tab === "I use" ? useRows : tab === "Following" ? following : favorites;
  const rows = (
    demo
      ? SAMPLE_SHELF.map((p) => ({ ...p, href: `/journey/${p.id}` })).filter(
          (_, i) =>
            tab === "I use" || (tab === "Following" ? i === 0 : i === 1),
        )
      : liveRows
  ).filter((p) =>
    `${p.name} ${p.brand ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell
      title="My Products"
      serif
      notify
      subtitle={COPY.productTabSubtitle}
    >
      <DemoBanner />
      <LinearGradient
        colors={["#245B4C", "#173A30"]}
        style={{ padding: 24, borderRadius: 28, gap: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Clock color="#CBE6CC" size={20} />
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 12,
              letterSpacing: 1,
              color: "#CBE6CC",
            }}
          >
            YOUR OWN PRODUCT JOURNALS
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 31,
            lineHeight: 37,
            color: "#fff",
          }}
        >
          Keep the changes. Find your pattern.
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 15,
            lineHeight: 23,
            color: "#EEDCE1",
          }}
        >
          What felt different this week? Keep your routine, photos and honest
          updates together. Pick up whenever you’re ready.
        </Text>
        <ActionButton
          tone="gold"
          label="Track a product"
          onPress={() => router.push("/products/add")}
        />
        <View style={{ flexDirection: "row", gap: 16 }}>
          {[
            { Icon: Camera, text: "Photos over time" },
            { Icon: Lock, text: "Private by default" },
          ].map(({ Icon, text }) => (
            <View
              key={text}
              style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
            >
              <Icon size={15} color="#DEC4CC" />
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 12,
                  color: "#DEC4CC",
                }}
              >
                {text}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>
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
      {!demo && (journeys.isError || experiences.isError || subs.isError) ? (
        <StatusMessage
          kind="error"
          title="Some of your products couldn’t load."
          detail="Refresh before adding the same product again."
        />
      ) : null}
      {!demo &&
      uid &&
      (journeys.isLoading || experiences.isLoading || subs.isLoading) ? (
        <StorySkeleton />
      ) : rows.length ? (
        <View style={{ gap: 16 }}>
          {rows.map((p) => {
            const detail = p as typeof p & {
              status?: string;
              visibility?: string;
              journeyId?: string;
              verified?: boolean;
            };
            return (
              <View
                key={p.id}
                style={{
                  borderRadius: 24,
                  backgroundColor: "#FAF7F3",
                  borderWidth: 1,
                  borderColor: "#E8DED6",
                  overflow: "hidden",
                }}
              >
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${p.name}`}
                  onPress={() => {
                    hapticSelect();
                    router.push(p.href as Href);
                  }}
                  style={({ pressed }) => ({
                    padding: 18,
                    flexDirection: "row",
                    gap: 16,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View style={{ width: 104 }}>
                    <MediaFrame
                      uri={p.image}
                      label={p.name}
                      ratio={0.9}
                      corners={false}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 7, justifyContent: "center" }}>
                    <Text
                      style={{
                        fontFamily: fonts.medium,
                        fontSize: 11,
                        color: colors.brand,
                      }}
                    >
                      {demo
                        ? "DEMO TIMELINE"
                        : detail.status || tab.toUpperCase()}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.semibold,
                        fontSize: 20,
                        lineHeight: 26,
                        color: colors.ink,
                      }}
                    >
                      {p.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.regular,
                        fontSize: 13,
                        lineHeight: 20,
                        color: colors.inkSoft,
                      }}
                    >
                      {p.note}
                    </Text>
                    {detail.visibility ? (
                      <Text
                        style={{
                          fontFamily: fonts.medium,
                          fontSize: 11,
                          color: colors.inkSoft,
                        }}
                      >
                        {detail.visibility === "public"
                          ? "Shared timeline"
                          : "Private · just for you"}
                        {detail.verified ? " · Ownership verified" : ""}
                      </Text>
                    ) : null}
                  </View>
                  <ArrowRight size={19} color={colors.brand} />
                </Pressable>
                {detail.journeyId ? (
                  <View
                    style={{ paddingHorizontal: 18, paddingBottom: 16, gap: 8 }}
                  >
                    <ActionButton
                      label="Add an update"
                      onPress={() =>
                        router.push(
                          `/journey/${detail.journeyId}/update` as Href,
                        )
                      }
                    />
                    <ActionButton
                      tone="ghost"
                      label="See my timeline & routine"
                      onPress={() => router.push(p.href as Href)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
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
