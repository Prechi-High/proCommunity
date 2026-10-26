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
import * as living from "@/lib/living/api";
import { rememberProduct } from "@/lib/products";

export default function AskCommunity() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  const rows = (q.data ?? [])
    .filter((p) =>
      `${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 20);

  return (
    <AppShell
      back
      title={COPY.questionPrompt}
      subtitle="Pick a product. Asking is free. Don’t buy blind."
    >
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Find a product"
      />
      {q.isLoading ? <ContentSkeleton /> : null}
      {q.isError ? (
        <StatusMessage kind="error" title="Couldn’t load products." />
      ) : null}
      {rows.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => {
            rememberProduct({
              id: p.id,
              name: p.name,
              brand: p.brand || "",
              category: p.category || "Product",
              heroImageUrl: p.image_url,
            });
            router.push(`/product/${p.id}/ask-community` as Href);
          }}
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            minHeight: 64,
          }}
        >
          <View style={{ width: 56 }}>
            <MediaFrame uri={p.image_url} label={p.name} ratio={1} />
          </View>
          <View style={{ flex: 1 }}>
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
              {p.brand}
            </Text>
          </View>
        </Pressable>
      ))}
      <ActionButton
        tone="ghost"
        label="Search more products"
        onPress={() => router.push("/results" as Href)}
      />
    </AppShell>
  );
}
