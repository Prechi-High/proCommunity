import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import {
  ActionButton,
  AppShell,
  MediaFrame,
  SearchField,
  StatusMessage,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import { rememberProduct } from "@/lib/products";
import { isBeautyCatalogItem } from "@/lib/unmask/beautyCatalog";
import {
  popularBeautyProducts,
  searchCommunityProducts,
  type PopularBeautyProduct,
} from "@/lib/unmask/communitySearch";

export default function AskCommunity() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const popular = useQuery({
    queryKey: ["popular-beauty-products"],
    queryFn: () => popularBeautyProducts(12),
  });
  const lookup = useQuery({
    queryKey: ["ask-product-search", search],
    queryFn: () => searchCommunityProducts(search),
    enabled: search.trim().length > 1,
  });
  const rows: PopularBeautyProduct[] = (
    search.trim().length > 1 ? lookup.data ?? [] : popular.data ?? []
  )
    .filter((p) => isBeautyCatalogItem(p.category, p.name, p.brand))
    .map((p) => ({
      ...p,
      searchCount:
        "searchCount" in p && typeof p.searchCount === "number" ? p.searchCount : 0,
    }));
  const loading =
    search.trim().length > 1 ? lookup.isLoading : popular.isLoading;
  const loadError =
    search.trim().length > 1 ? lookup.isError : popular.isError;

  const open = (p: (typeof rows)[number]) => {
    rememberProduct({
      id: p.id,
      name: p.name,
      brand: p.brand || "",
      category: p.category || "Beauty",
      heroImageUrl: p.heroImageUrl,
    });
    router.push(`/product/${p.id}/ask-community` as Href);
  };

  return (
    <AppShell
      back
      title={COPY.questionPrompt}
      subtitle="Pick a beauty product. Asking is free. Don’t buy blind."
    >
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Find a cream, serum, or routine"
      />
      {loading ? <ContentSkeleton /> : null}
      {loadError ? (
        <StatusMessage kind="error" title="Couldn’t load products." />
      ) : null}
      {!search.trim() ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            lineHeight: 19,
            color: colors.inkSoft,
          }}
        >
          Popular in Unmask searches right now — beauty and skincare only.
        </Text>
      ) : null}
      {rows.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => open(p)}
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            minHeight: 64,
            paddingVertical: 6,
          }}
        >
          <View style={{ width: 56 }}>
            <MediaFrame uri={p.heroImageUrl} label={p.name} ratio={1} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 16,
                color: colors.ink,
              }}
            >
              {p.name}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 14,
                color: colors.inkSoft,
              }}
            >
              {p.brand || "Beauty"}
              {p.searchCount > 0
                ? ` · ${p.searchCount} recent search${p.searchCount === 1 ? "" : "es"}`
                : ""}
            </Text>
          </View>
        </Pressable>
      ))}
      {!loading && !rows.length ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>
          {search.trim().length > 1
            ? "No beauty match yet. Try the name on the label — Caro White, Carotone, a serum, or a cream."
            : "Suggestions will appear when the catalog finishes loading."}
        </Text>
      ) : null}
      <ActionButton
        tone="ghost"
        label="Search the full catalog"
        onPress={() => router.push("/results" as Href)}
      />
    </AppShell>
  );
}
