import { useScan } from "@/lib/useScan";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { KnowBeforeYouBuyHub } from "@/components/vision/KnowBeforeYouBuyHub";
import { rememberProduct } from "@/lib/products";
import { useAppStore } from "@/lib/store";
import { searchCommunityProducts } from "@/lib/unmask/communitySearch";
import { SAMPLE_SHELF } from "@/lib/unmask/samples";
import type { Product } from "@/lib/types";

export default function Results() {
  const router = useRouter();
  const scan = useScan();
  const demo = useAppStore((s) => s.demoCommunity);
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [draft, setDraft] = useState(q || "");
  const [query, setQuery] = useState(q || "");

  useEffect(() => {
    setDraft(q || "");
    setQuery(q || "");
  }, [q]);

  const result = useQuery({
    queryKey: ["community-product-search", query, demo],
    queryFn: async () => {
      const live = await searchCommunityProducts(query);
      const examples = demo
        ? SAMPLE_SHELF.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(query.trim().toLowerCase())).map((p) => ({
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

  const open = (p: Product) => {
    rememberProduct(p);
    router.push({ pathname: "/product/[id]", params: { id: p.id, name: p.name } } as Href);
  };

  return (
    <View style={{ flex: 1 }}>
      <KnowBeforeYouBuyHub
        query={query}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={submit}
        products={result.data ?? []}
        loading={result.isLoading}
        onPick={open}
      />
      {scan.sheet}
      {query && !result.isLoading && !(result.data ?? []).length ? (
        <View />
      ) : null}
    </View>
  );
}