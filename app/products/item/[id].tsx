import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  AppShell,
  ActionButton,
  ContentSkeleton,
  StatusMessage,
} from "@/components/unmask-ui";
import { JournalProduct, JournalCard } from "@/components/tracking/JournalUI";
import { Note } from "@/components/tracking/Fields";
import * as living from "@/lib/living/api";
import { getKnownProduct } from "@/lib/products";
export default function ShelfProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRouter();
  const known = getKnownProduct(id);
  const q = useQuery({
    queryKey: ["catalog", id],
    queryFn: () => living.catalog(id),
  });
  const p = q.data?.[0];
  return (
    <AppShell
      back
      navigation
      title="My Products"
      subtitle="A place for your own experience, whenever you’re ready."
    >
      {q.isLoading && !known ? (
        <ContentSkeleton />
      ) : (
        <JournalProduct
          name={p?.name || known?.name || "Your product"}
          brand={p?.brand || known?.brand}
          image={p?.image_url || known?.heroImageUrl}
        />
      )}
      <JournalCard
        title="Give this product its own story."
        detail="Add when you started, how you use it and what you notice. Keep photos and updates together in your own journal."
      >
        <ActionButton
          label="Add my experience or start tracking"
          onPress={() =>
            r.push(`/products/add?product=${encodeURIComponent(id)}` as Href)
          }
        />
        <Note>
          Your journal starts private. You can choose to share it later.
        </Note>
      </JournalCard>
      <ActionButton
        tone="ghost"
        label="Explore community experiences separately"
        onPress={() => r.push(`/product/${id}` as Href)}
      />
      {q.isError && !known ? (
        <StatusMessage kind="error" title="Product details couldn’t load." />
      ) : null}
    </AppShell>
  );
}
