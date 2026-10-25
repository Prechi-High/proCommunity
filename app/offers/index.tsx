import { db } from "@/lib/clarity/api";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { TodayPage } from "@/components/today/Page";
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
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/team/api";
export default function Offers() {
  const r = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const q = useQuery({
    queryKey: ["offers", "public"],
    queryFn: () => api.offers(),
  });
  const ids = [...new Set((q.data ?? []).map((o) => o.product_id))].sort();
  const counts = useQuery({
    queryKey: ["offer-counts", ids],
    enabled: ids.length > 0,
    queryFn: () =>
      api.read<{ product_id: string; experience_count: number }[]>(
        db().rpc("unmask_offer_evidence_counts", { p_ids: ids }),
      ),
  });
  const rows = q.data?.filter(
    (o) =>
      (category === "All" || o.unmask_catalog?.category === category) &&
      `${o.sponsor} ${o.title} ${o.unmask_catalog?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <TodayPage
      title="Offers"
      sub="Explore sponsored store and brand opportunities alongside what the community knows."
    >
      <Field
        label="Search offers, brands or products"
        value={search}
        onChange={setSearch}
      />
      <Chips
        options={[
          "All",
          ...new Set(
            (q.data ?? [])
              .map((o) => o.unmask_catalog?.category)
              .filter((c): c is string => !!c),
          ),
        ]}
        value={category}
        onChange={setCategory}
      />
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {rows?.map((o) => (
        <Card key={o.id}>
          <Pill>Sponsored · {o.kind}</Pill>
          <Heading>{o.sponsor}</Heading>
          <Photo uri={o.unmask_catalog?.image_url} size={180} />
          <Heading>{o.unmask_catalog?.name || o.title}</Heading>
          <Copy>{o.title}</Copy>
          <Copy small>Seller description</Copy>
          <Copy>{o.description}</Copy>
          <Copy small>{o.disclosure}</Copy>
          {counts.isSuccess ? (
            <Copy>
              {counts.data.find((c) => c.product_id === o.product_id)
                ?.experience_count || 0}{" "}
              public community experiences
            </Copy>
          ) : null}
          <Button
            quiet
            label="See community experiences"
            onPress={() => r.push(`/product/${o.product_id}` as Href)}
          />
          <Button
            label={
              o.kind === "Experience programme"
                ? "Learn about programme"
                : "View offer"
            }
            onPress={() => r.push(`/offers/${o.id}` as Href)}
          />
        </Card>
      ))}
      {rows?.length === 0 ? (
        <Copy>No active offers match this view.</Copy>
      ) : null}
      <Copy small>
        Showing up to 100 active offers. Sponsorship does not determine findings
        or authenticate stock.
      </Copy>
    </TodayPage>
  );
}
