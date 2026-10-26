import { useScan } from "@/lib/useScan";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import {
  ActionButton,
  AppShell,
  EmptyState,
  FocusCorners,
  MediaFrame,
  SearchField,
  StatusMessage,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import { rememberProduct, slugify } from "@/lib/products";
import { useAppStore } from "@/lib/store";
import {
  searchCommunityProducts,
  hasProductConversation,
} from "@/lib/unmask/communitySearch";
import { SAMPLE_SHELF, SAMPLE_FEED } from "@/lib/unmask/samples";
import type { Product } from "@/lib/types";

export default function Results() {
  const router = useRouter();
  const scan = useScan();
  const demo = useAppStore((s) => s.demoCommunity);
  const [openError, setOpenError] = useState("");
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [draft, setDraft] = useState(q || "");
  const [query, setQuery] = useState(q || "");
  const [picked, setPicked] = useState("");
  useEffect(() => {
    setDraft(q || "");
    setQuery(q || "");
  }, [q]);
  const result = useQuery({
    queryKey: ["community-product-search", query, demo],
    queryFn: async () => {
      const live = await searchCommunityProducts(query);
      const examples = demo
        ? SAMPLE_SHELF.filter((p) =>
            `${p.name} ${p.brand}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
          ).map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            category: "Skin",
            heroImageUrl: p.image,
          }))
        : [];
      return [...examples, ...live];
    },
    enabled: query.trim().length > 1,
    staleTime: 600000,
    retry: 1,
  });
  const submit = () => {
    if (draft.trim()) {
      setQuery(draft.trim());
      useAppStore.getState().addSearch(draft.trim());
    }
  };
  const open = async (p: Product) => {
    rememberProduct(p);
    setPicked(p.id);
    setOpenError("");
    try {
      const has = p.id.startsWith("demo-")
        ? SAMPLE_FEED.some((x) => x.productId === p.id)
        : await hasProductConversation(p.id);
      router.push({
        pathname: has ? "/product/[id]" : "/product/[id]/ask-community",
        params: { id: p.id, name: p.name },
      } as Href);
    } catch {
      setOpenError("Couldn’t check the conversations. Please try again.");
    } finally {
      setPicked("");
    }
  };
  const products = result.data ?? [];
  const askNew = () => {
    const name = draft.trim();
    if (!name) return;
    const id = `community-${slugify(name)}`;
    rememberProduct({
      id,
      name,
      brand: "",
      category: "Product",
      heroImageUrl: null,
    });
    router.push({
      pathname: "/product/[id]/ask-community",
      params: { id, name },
    } as Href);
  };

  return (
    <AppShell
      back
      navigation
      title="Find a product"
      subtitle="Find the product. Hear from people who have tried it."
    >
      <SearchField
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        onCamera={scan.openCamera}
      />
      {scan.sheet}

      {openError ? <StatusMessage kind="error" title={openError} /> : null}
      {picked ? (
        <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
          Opening community conversations…
        </Text>
      ) : null}
      {result.isError ? (
        <StatusMessage
          kind="error"
          title="Search didn’t finish."
          detail="Your query is still here. Try again."
        />
      ) : null}
      {result.isLoading ? (
        <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
          Looking…
        </Text>
      ) : null}
      {products.map((p) => (
        <Pressable
          key={p.id}
          disabled={!!picked}
          accessibilityRole="button"
          accessibilityLabel={`Open ${p.name}`}
          onPress={() => void open(p)}
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            minHeight: 72,
          }}
        >
          <View style={{ width: 72, position: "relative" }}>
            <MediaFrame uri={p.heroImageUrl} label={p.name} ratio={1} />
            <FocusCorners selected={picked === p.id} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
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
              {p.brand || p.category}
            </Text>
          </View>
        </Pressable>
      ))}
      {query && !result.isLoading && !result.isError && !products.length ? (
        <EmptyState
          title="No matching product here yet."
          detail="Our catalogue grows with the community. Start a question with the product name."
          action={`Ask about ${query}`}
          onAction={askNew}
        />
      ) : null}
    </AppShell>
  );
}
