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
import { rememberProduct, searchProducts } from "@/lib/products";
import { useAppStore } from "@/lib/store";
import type { Product } from "@/lib/types";

export default function Results() {
  const router = useRouter();
  const scan = useScan();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [draft, setDraft] = useState(q || "");
  const [query, setQuery] = useState(q || "");
  const [picked, setPicked] = useState("");
  useEffect(() => {
    setDraft(q || "");
    setQuery(q || "");
  }, [q]);
  const result = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchProducts(query),
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
  const open = (p: Product) => {
    rememberProduct(p);
    setPicked(p.id);
    router.push({
      pathname: "/product/[id]",
      params: { id: p.id, q: p.name },
    } as Href);
  };
  const products = result.data?.products || [];

  return (
    <AppShell
      back
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
      <ActionButton tone="secondary" label="Search" onPress={submit} />
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
          onPress={() => open(p)}
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
      {query && !result.isLoading && !products.length ? (
        <EmptyState
          title={COPY.noMatch}
          detail={COPY.noMatchNext}
          action="Add its name"
          onAction={() => router.push("/products/add" as Href)}
        />
      ) : null}
    </AppShell>
  );
}
