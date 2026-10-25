import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ProductsPage } from "@/components/my-products/Page";
import { SignInCard } from "@/components/utilities/Page";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Photo,
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import type { ProductState } from "@/lib/living/types";
export default function AddProduct() {
  const { product } = useLocalSearchParams<{ product?: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(product || "");
  const [status, setStatus] = useState("Currently using");
  const [acquisition, setAcquisition] = useState("purchased");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = useQuery({ queryKey: ["catalog"], queryFn: () => api.catalog() });
  const exact = useQuery({
    queryKey: ["catalog", product],
    queryFn: () => api.catalog(product),
    enabled: !!product,
  });
  const mine = useQuery({
    queryKey: ["living", "journeys", uid],
    queryFn: api.journeys,
    enabled: !!uid,
  });
  const p =
    q.data?.find((p) => p.id === selected) ||
    exact.data?.find((p) => p.id === selected);
  const existing = mine.data?.some((j) => j.product_id === selected);
  const save = async () => {
    if (!p) return;
    setBusy(true);
    setError("");
    try {
      const state: ProductState =
        status === "Currently using"
          ? "active"
          : status === "Paused use"
            ? "paused"
            : status === "Previously used"
              ? "stopped"
              : "purchased";
      await api.saveJourney({
        product_id: p.id,
        acquisition,
        status: state,
        visibility: "private",
      });
      await qc.invalidateQueries({ queryKey: ["living", "journeys"] });
      r.replace("/products");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this product.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ProductsPage
      title="Add a product you use."
      sub="Start a private use record. Sharing an experience is a separate choice."
    >
      {!uid ? (
        <SignInCard />
      ) : (
        <>
          <Busy
            loading={q.isLoading || mine.isLoading}
            error={q.error || mine.error}
            retry={() => {
              void q.refetch();
              void mine.refetch();
            }}
          />
          {p ? (
            <>
              <Card>
                <Photo uri={p.image_url} size={120} />
                <Heading>{p.name}</Heading>
                <Copy>{p.brand}</Copy>
                <Button
                  quiet
                  label="Choose another product"
                  onPress={() => setSelected("")}
                />
              </Card>
              {existing ? (
                <Notice>This product is already in your use records.</Notice>
              ) : (
                <>
                  <Chips
                    options={[
                      "Currently using",
                      "Paused use",
                      "Previously used",
                      "Not started",
                    ]}
                    value={status}
                    onChange={setStatus}
                  />
                  <Copy>How did you get it?</Copy>
                  <Chips
                    options={[
                      "purchased",
                      "gifted",
                      "sample",
                      "brand_supplied",
                      "content_exchange",
                      "other",
                    ]}
                    value={acquisition}
                    onChange={setAcquisition}
                  />
                  <Button
                    disabled={busy || mine.isLoading || mine.isError}
                    label={busy ? "Saving…" : "Add privately to My Products"}
                    onPress={() => void save()}
                  />
                </>
              )}
              <Button
                quiet
                label="View your experience timeline"
                onPress={() =>
                  r.push(`/products/timeline?product=${p.id}` as Href)
                }
              />
            </>
          ) : (
            <>
              <Field
                label="Search the product catalog"
                value={search}
                onChange={setSearch}
              />
              {q.data
                ?.filter((p) =>
                  `${p.name} ${p.brand}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .slice(0, 30)
                .map((p) => (
                  <Button
                    quiet
                    key={p.id}
                    label={`${p.brand || ""} ${p.name}`}
                    onPress={() => setSelected(p.id)}
                  />
                ))}
            </>
          )}
          <Button
            quiet
            label="Can't find it? Search Unmask"
            onPress={() => r.push("/unmask")}
          />
          {error ? <Notice>{error}</Notice> : null}
        </>
      )}
    </ProductsPage>
  );
}
