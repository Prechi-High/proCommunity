import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { CommunityProductFlow } from "@/components/unmask/reference/CommunityProductFlow";
import {
  getKnownProduct,
  callIntel,
  profileToProduct,
  resolveProductPreview,
  previewToProfile,
} from "@/lib/products";
import { routeId } from "@/lib/catalog";
import { useAppStore } from "@/lib/store";
import type { ProductProfile } from "@/lib/types";

/** Community-first: read saved knowledge; never start an investigation on open. */
export default function ProductScreen() {
  const params = useLocalSearchParams<{ id: string; q?: string }>();
  const id = routeId(params.id);
  const known = useAppStore((s) => s.knownProducts[id]);
  const addRecent = useAppStore((s) => s.addRecentProduct);
  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);
  const saved = useQuery({
    queryKey: ["intel", id],
    queryFn: async () =>
      (
        await callIntel<{ profile?: ProductProfile | null }>(
          { action: "get", productId: id },
          20000,
        )
      ).profile || null,
    enabled: !!id,
    staleTime: 1800000,
    retry: 1,
  });
  const preview = useQuery({
    queryKey: ["preview", id],
    queryFn: () =>
      resolveProductPreview({
        id,
        query: params.q,
        name: known?.name,
        brand: known?.brand,
      }),
    enabled: !!id && !known && !saved.isLoading && !saved.data,
    staleTime: 1800000,
    retry: 1,
  });
  const profile =
    saved.data ||
    (preview.data ? previewToProfile(preview.data.preview) : null);
  const product = profile
    ? profileToProduct(profile, known)
    : known ||
      getKnownProduct(id) || {
        id,
        name: params.q || id.replace(/-/g, " "),
        brand: "",
        category: "Product",
      };
  return (
    <CommunityProductFlow
      key={id}
      product={product}
      profile={profile}
      loading={saved.isLoading || preview.isFetching}
      error={saved.error || preview.error}
      retry={() => {
        void saved.refetch();
        if (!known) void preview.refetch();
      }}
    />
  );
}
