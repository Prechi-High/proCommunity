import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
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
  Photo,
  Pill,
  ink,
} from "@/components/unmask/reference/ui";
import { FollowButton } from "@/components/living/FollowButton";
import { useAppStore } from "@/lib/store";
import * as clarity from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import * as api from "@/lib/my-products/api";
type Entry = {
  id: string;
  type: string;
  body: string;
  date: string;
  visibility: string;
  duration: string;
  route: string;
};
export default function Timeline() {
  const r = useRouter();
  const { product } = useLocalSearchParams<{ product?: string }>();
  const uid = useAppStore((s) => s.profile?.id);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Latest updates");
  const [filter, setFilter] = useState(product || "All products");
  const [choose, setChoose] = useState(false);
  const favorites = useAppStore((s) => s.favorites);
  const toggle = useAppStore((s) => s.toggleFavorite);
  const remember = useAppStore((s) => s.rememberProduct);
  const ex = useQuery({
    queryKey: ["my-clarity-experiences", uid],
    queryFn: () => clarity.experiences(true),
    enabled: !!uid,
  });
  const up = useQuery({
    queryKey: ["my-experience-followups", uid],
    queryFn: api.followups,
    enabled: !!uid,
  });
  const journeys = useQuery({
    queryKey: ["living", "journeys", uid],
    queryFn: living.journeys,
    enabled: !!uid,
  });
  const drafts = useQuery({
    queryKey: ["experience-drafts", uid],
    queryFn: () => api.drafts(uid!),
    enabled: !!uid,
  });
  const legacy = useQuery({
    queryKey: ["my-legacy-experiences", uid],
    queryFn: api.legacyEntries,
    enabled: !!uid,
  });
  const allIds = [
    ...new Set([
      ...(journeys.data ?? []).map((j) => j.product_id),
      ...(ex.data ?? []).map((e) => e.product_id),
      ...(legacy.data ?? []).map((e) => e.unmask_journeys.product_id),
      ...(drafts.data ?? [])
        .filter(
          (d) => d.target !== "new" && !ex.data?.some((e) => e.id === d.target),
        )
        .map((d) => d.target),
    ]),
  ];
  const groups = allIds
    .map((id) => {
      const j = journeys.data?.find((j) => j.product_id === id);
      const experiences = ex.data?.filter((e) => e.product_id === id) ?? [];
      const old =
        legacy.data?.filter((e) => e.unmask_journeys.product_id === id) ?? [];
      const p =
        j?.unmask_catalog ||
        experiences[0]?.unmask_catalog ||
        old[0]?.unmask_journeys.unmask_catalog;
      const entries: Entry[] = experiences.flatMap((e) => [
        {
          id: e.id,
          type: "First experience",
          body: e.body,
          date: e.created_at,
          visibility: e.visibility,
          duration: e.duration,
          route: `/contribute?experience=${e.id}`,
        },
        ...(up.data ?? [])
          .filter((u) => u.experience_id === e.id)
          .map((u) => ({
            id: u.id,
            type: "Follow-up",
            body: u.body,
            date: u.created_at,
            visibility: e.visibility,
            duration: u.duration,
            route: `/contribute?experience=${e.id}`,
          })),
      ]);
      entries.push(
        ...old.map((e) => ({
          id: e.id,
          type: "Earlier journey entry",
          body: e.changed,
          date: e.created_at,
          visibility: e.visibility,
          duration: "",
          route: `/journey/${e.journey_id}`,
        })),
      );
      const draft =
        drafts.data?.filter(
          (d) => d.target === id || experiences.some((e) => e.id === d.target),
        ) ?? [];
      return {
        id,
        j,
        p,
        experiences,
        entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
        draft,
        last:
          entries
            .map((e) => e.date)
            .sort()
            .at(-1) ||
          j?.created_at ||
          "",
      };
    })
    .filter(
      (g) =>
        (filter === "All products" || g.id === filter) &&
        `${g.p?.name} ${g.entries.map((e) => e.body).join(" ")} ${g.draft.map((d) => d.body).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Latest updates"
        ? b.last.localeCompare(a.last)
        : a.last.localeCompare(b.last),
    );
  return (
    <ProductsPage
      title="Your experience, over time."
      sub="Everything you shared, connected to its product."
    >
      {!uid ? (
        <SignInCard />
      ) : (
        <>
          <Field
            label="Search experiences"
            value={search}
            onChange={setSearch}
          />
          <Button
            quiet
            label={
              filter === "All products"
                ? "All products ▾"
                : groups.find((g) => g.id === filter)?.p?.name ||
                  "Selected product ▾"
            }
            onPress={() => setChoose(!choose)}
          />
          {choose ? (
            <Card>
              <Button
                quiet
                label="All products"
                onPress={() => {
                  setFilter("All products");
                  setChoose(false);
                }}
              />
              {allIds.map((id) => (
                <Button
                  quiet
                  key={id}
                  label={
                    journeys.data?.find((j) => j.product_id === id)
                      ?.unmask_catalog?.name ||
                    ex.data?.find((e) => e.product_id === id)?.unmask_catalog
                      ?.name ||
                    id
                  }
                  onPress={() => {
                    setFilter(id);
                    setChoose(false);
                  }}
                />
              ))}
            </Card>
          ) : null}
          <Chips
            options={["Latest updates", "Oldest updates"]}
            value={sort}
            onChange={setSort}
          />
          <Busy
            loading={
              ex.isLoading ||
              up.isLoading ||
              journeys.isLoading ||
              drafts.isLoading ||
              legacy.isLoading
            }
            error={
              ex.error ||
              up.error ||
              journeys.error ||
              drafts.error ||
              legacy.error
            }
            retry={() => {
              void ex.refetch();
              void up.refetch();
              void journeys.refetch();
              void drafts.refetch();
              void legacy.refetch();
            }}
          />
          {groups.map((g) => (
            <Card key={g.id}>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <Photo uri={g.p?.image_url} size={90} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Heading>{g.p?.name || "Product draft"}</Heading>
                  {g.j ? <Pill>{api.statusLabels[g.j.status]}</Pill> : null}
                  <Button
                    quiet
                    label={
                      favorites.some((f) => f.productId === g.id)
                        ? "Saved · remove"
                        : "Save product"
                    }
                    onPress={() => {
                      if (g.p)
                        remember({
                          id: g.id,
                          name: g.p.name,
                          brand: g.p.brand || "",
                          category: "",
                          heroImageUrl: g.p.image_url,
                        });
                      toggle(g.id);
                    }}
                  />
                  <FollowButton type="product" id={g.id} />
                </View>
              </View>
              {g.entries.map((e) => (
                <View
                  key={e.id}
                  style={{
                    borderLeftWidth: 2,
                    borderColor: ink.brand,
                    paddingLeft: 14,
                    gap: 8,
                  }}
                >
                  <Copy>
                    {e.type}
                    {e.duration ? ` · ${e.duration}` : ""}
                  </Copy>
                  <Copy small>{new Date(e.date).toLocaleDateString()}</Copy>
                  <Copy>{e.body}</Copy>
                  <Pill>
                    {e.visibility === "public"
                      ? "Public"
                      : e.visibility === "followers"
                        ? "Followers only"
                        : "Private · only you"}
                  </Pill>
                  <Button
                    quiet
                    label={
                      e.type === "Follow-up"
                        ? "View update →"
                        : "View experience →"
                    }
                    onPress={() => r.push(e.route as Href)}
                  />
                </View>
              ))}
              {g.draft.map((d) => (
                <Card key={d.key}>
                  <Pill>Draft · not published</Pill>
                  <Copy>{d.body}</Copy>
                  <Copy small>Saved on this device. Only visible to you.</Copy>
                  <Button
                    quiet
                    label="Continue draft"
                    onPress={() =>
                      r.push(
                        (g.experiences.some((e) => e.id === d.target)
                          ? `/contribute?experience=${d.target}&update=1`
                          : `/contribute?product=${g.id}`) as Href,
                      )
                    }
                  />
                </Card>
              ))}
              {g.entries.length === 0 && g.draft.length === 0 ? (
                <Copy>
                  No experience recorded yet. Your use record stays private.
                </Copy>
              ) : null}
              <Button
                label={
                  g.experiences.length
                    ? "＋ Add an update"
                    : "Share an experience"
                }
                onPress={() =>
                  r.push(
                    (g.experiences.length
                      ? `/contribute?experience=${g.experiences[0].id}&update=1`
                      : `/contribute?product=${g.id}`) as Href,
                  )
                }
              />
            </Card>
          ))}
          {groups.length === 0 && !ex.isLoading ? (
            <Copy>No product experiences match this view.</Copy>
          ) : null}
          <Button
            quiet
            label="Add a product"
            onPress={() => r.push("/products/add")}
          />
        </>
      )}
    </ProductsPage>
  );
}
