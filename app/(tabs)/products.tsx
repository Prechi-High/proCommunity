import { useEffect, useState } from "react";
import { View } from "react-native";
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
  Pill,
} from "@/components/unmask/reference/ui";
import { FollowButton } from "@/components/living/FollowButton";
import { useAppStore } from "@/lib/store";
import { displayName } from "@/lib/products";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import { statusLabels } from "@/lib/my-products/api";
import type { ProductState } from "@/lib/living/types";
export default function MyProducts() {
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState(
    section === "watching" ? "Following" : "I use",
  );
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saved = useAppStore((s) => s.favorites);
  const known = useAppStore((s) => s.knownProducts);
  const toggle = useAppStore((s) => s.toggleFavorite);
  useEffect(() => {
    if (section === "routines" || section === "requests") r.replace(`/products/library?section=${section}` as Href);
    if (section === "watching") setTab("Following");
    if (section === "saved") setTab("Saved");
  }, [section, r]);
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
  const useRows = [
    ...(journeys.data ?? []).map((j) => ({
      id: j.product_id,
      name: j.unmask_catalog?.name || j.product_id,
      brand: j.unmask_catalog?.brand,
      image: j.unmask_catalog?.image_url,
      status: statusLabels[j.status],
      journey: j.id,
      experience: experiences.data?.find((e) => e.product_id === j.product_id),
    })),
    ...(experiences.data ?? [])
      .filter(
        (e, i, a) =>
          !journeys.data?.some((j) => j.product_id === e.product_id) &&
          a.findIndex((x) => x.product_id === e.product_id) === i,
      )
      .map((e) => ({
        id: e.product_id,
        name: e.unmask_catalog?.name || e.product_id,
        brand: e.unmask_catalog?.brand,
        image: e.unmask_catalog?.image_url,
        status: e.usage_status,
        journey: null,
        experience: e,
      })),
  ];
  const following = (subs.data ?? [])
    .filter((s) => s.target_type === "product")
    .map((s) => {
      const p = catalog.data?.find((p) => p.id === s.target_id);
      return {
        id: s.target_id,
        name: p?.name || known[s.target_id]?.name || s.target_id,
        brand: p?.brand,
        image: p?.image_url,
        status: "Following",
        journey: null,
        experience: undefined,
      };
    });
  const favorites = saved.map((s) => ({
    id: s.productId,
    name: known[s.productId]
      ? displayName(known[s.productId])
      : catalog.data?.find((p) => p.id === s.productId)?.name || s.productId,
    brand: known[s.productId]?.brand,
    image: known[s.productId]?.heroImageUrl,
    status: "Saved",
    journey: null,
    experience: undefined,
  }));
  const rows = (
    tab === "I use" ? useRows : tab === "Following" ? following : favorites
  ).filter((p) =>
    `${p.name} ${p.brand ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const change = async (journey: string, status: ProductState) => {
    setBusy(true);
    setError("");
    try {
      await living.patchJourney(journey, {
        status,
        stopped_on: ["stopped", "finished", "replaced"].includes(status)
          ? new Date().toISOString().slice(0, 10)
          : null,
      });
      await qc.invalidateQueries({ queryKey: ["living", "journeys"] });
      setMenu("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change use status.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ProductsPage root title="Your products, your perspective.">
      <Field label="Search my products" value={search} onChange={setSearch} />
      <Chips
        options={["I use", "Following", "Saved"]}
        value={tab}
        onChange={setTab}
      />
      <Button label="＋ Add product" onPress={() => r.push("/products/add")} />
      <Button
        quiet
        label="Your experience timeline →"
        onPress={() => r.push("/products/timeline")}
      />
      {tab === "Following" ? (
        <Button
          label="View followed-product activity"
          onPress={() => r.push("/products/following")}
        />
      ) : null}
      {tab !== "Saved" && !uid ? (
        <SignInCard />
      ) : (
        <>
          <Busy
            loading={
              tab === "I use"
                ? journeys.isLoading || experiences.isLoading
                : tab === "Following"
                  ? subs.isLoading || catalog.isLoading
                  : false
            }
            error={
              tab === "I use"
                ? journeys.error || experiences.error
                : tab === "Following"
                  ? subs.error || catalog.error
                  : null
            }
            retry={() => {
              void journeys.refetch();
              void experiences.refetch();
              void subs.refetch();
              void catalog.refetch();
            }}
          />
          {rows.map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <Photo uri={p.image} size={100} />
                <View style={{ flex: 1, gap: 8 }}>
                  {p.brand ? <Copy muted>{p.brand}</Copy> : null}
                  <Heading>{p.name}</Heading>
                  <Pill>{p.status || "Use status not recorded"}</Pill>
                </View>
              </View>
              {tab === "I use" ? (
                <>
                  <Button
                    quiet
                    label={
                      p.experience
                        ? "Experience recorded · Add update"
                        : "Share experience"
                    }
                    onPress={() =>
                      r.push(
                        p.experience
                          ? (`/contribute?experience=${p.experience.id}&update=1` as Href)
                          : (`/contribute?product=${p.id}` as Href),
                      )
                    }
                  />
                  <Button
                    quiet
                    label="Manage use status"
                    onPress={() => setMenu(menu === p.id ? "" : p.id)}
                  />
                  {menu === p.id ? (
                    p.journey ? (
                      <>
                        <Copy small>
                          Changes your product record; published experiences
                          retain their original context.
                        </Copy>
                        {[
                          ["active", "Currently using"],
                          ["paused", "Paused use"],
                          ["stopped", "Previously used"],
                          ["purchased", "Not started"],
                        ].map(([state, label]) => (
                          <Button
                            key={state}
                            quiet
                            disabled={busy}
                            label={label}
                            onPress={() =>
                              void change(p.journey!, state as ProductState)
                            }
                          />
                        ))}
                      </>
                    ) : (
                      <Button
                        quiet
                        label="Add a private use record"
                        onPress={() =>
                          r.push(`/products/add?product=${p.id}` as Href)
                        }
                      />
                    )
                  ) : null}
                </>
              ) : tab === "Following" ? (
                <FollowButton type="product" id={p.id} />
              ) : (
                <Button
                  quiet
                  label="Remove from saved"
                  onPress={() => toggle(p.id)}
                />
              )}
              <Button
                quiet
                label="View product →"
                onPress={() => r.push(`/product/${p.id}` as Href)}
              />
            </Card>
          ))}
          {rows.length === 0 ? (
            <Copy>
              {search
                ? "No products match your search."
                : tab === "I use"
                  ? "Add a product you use to start your private record."
                  : tab === "Following"
                    ? "Follow a product to keep up with its community activity."
                    : "Your saved products will appear here."}
            </Copy>
          ) : null}
        </>
      )}
      {error ? <Notice>{error}</Notice> : null}
      <Button
        quiet
        label="My routines & earlier product tools"
        onPress={() => r.push("/products/library?section=routines" as Href)}
      />
      <Card>
        <Heading>Keep your experience connected.</Heading>
        <Copy>Add updates whenever you have something new to share.</Copy>
        <Button
          quiet
          label="View experience timeline"
          onPress={() => r.push("/products/timeline")}
        />
      </Card>
    </ProductsPage>
  );
}
