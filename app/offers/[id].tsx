import { useState } from "react";
import { Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { TodayPage } from "@/components/today/Page";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Photo,
  Pill,
} from "@/components/unmask/reference/ui";
import { db } from "@/lib/clarity/api";
import { safeLink } from "@/lib/profiles/api";
import * as api from "@/lib/team/api";
export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRouter();
  const [terms, setTerms] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["offers", "detail", id],
    queryFn: () => api.offer(id),
  });
  const evidence = useQuery({
    queryKey: ["offer-evidence", q.data?.product_id],
    enabled: !!q.data,
    queryFn: async () => {
      const { count, error } = await db()
        .from("clarity_experiences")
        .select("id", { count: "exact", head: true })
        .eq("product_id", q.data!.product_id)
        .eq("visibility", "public")
        .eq("moderation_status", "visible");
      if (error) throw error;
      return count || 0;
    },
  });
  const investigations = useQuery({
    queryKey: ["offer-investigations", q.data?.product_id],
    enabled: !!q.data,
    queryFn: () =>
      api.read<{ id: string; title: string }[]>(
        db()
          .from("unmask_investigations")
          .select("id,title")
          .eq("product_id", q.data!.product_id)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(3),
      ),
  });
  const o = q.data;
  return (
    <TodayPage
      title={o?.unmask_catalog?.name || "Offer details"}
      sub="Sponsored placement · community findings remain independent."
    >
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {o ? (
        <>
          {o.status !== "active" ||
          (o.starts_at && Date.parse(o.starts_at) > Date.now()) ||
          (o.expires_at && Date.parse(o.expires_at) <= Date.now()) ? (
            <Notice>Private team preview · this offer is not active.</Notice>
          ) : null}
          <Photo uri={o.unmask_catalog?.image_url} size={220} />
          <Card>
            <Copy>Sponsored by</Copy>
            <Heading>{o.sponsor}</Heading>
            <Pill>{o.kind}</Pill>
            <Copy>{o.disclosure}</Copy>
            <Copy small>
              Sponsorship does not determine community findings or authenticate
              stock.
            </Copy>
          </Card>
          <Card>
            <Heading>{o.title}</Heading>
            <Copy small>Seller description</Copy>
            <Copy>{o.description}</Copy>
          </Card>
          <Card>
            <Heading>Community evidence</Heading>
            <Busy
              loading={evidence.isLoading}
              error={evidence.error}
              retry={() => void evidence.refetch()}
            />
            {evidence.isSuccess ? (
              <Heading>{evidence.data} public community experiences</Heading>
            ) : null}
            <Button
              label="See experiences"
              onPress={() => r.push(`/product/${o.product_id}` as Href)}
            />
            {o.store_url && safeLink(o.store_url) ? (
              <Button
                quiet
                label="Visit store ↗"
                onPress={() => setLeaving(true)}
              />
            ) : null}
          </Card>
          <Busy
            loading={investigations.isLoading}
            error={investigations.error}
          />
          {investigations.data?.map((i) => (
            <Card key={i.id}>
              <Pill>Creator investigation</Pill>
              <Heading>{i.title}</Heading>
              <Button
                label="Watch findings"
                onPress={() => r.push(`/investigation/${i.id}` as Href)}
              />
            </Card>
          ))}
          <Button
            quiet
            label="Commercial details and offer terms →"
            onPress={() => setTerms(!terms)}
          />
          {terms ? (
            <Card>
              <Copy>
                {o.terms ||
                  "No additional terms have been supplied. Check the store before buying."}
              </Copy>
              {o.expires_at ? (
                <Copy>
                  Offer expiry:{" "}
                  {new Date(o.expires_at).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })}
                </Copy>
              ) : null}
            </Card>
          ) : null}
          {leaving && o.store_url && safeLink(o.store_url) ? (
            <Card>
              <Heading>You're leaving Unmask</Heading>
              <Copy>
                This opens{" "}
                {o.store_url
                  ? new URL(o.store_url).hostname
                  : "an external store"}
                . Purchases, availability and content are managed by that store.
              </Copy>
              <Button
                label="Continue to external store"
                onPress={() =>
                  void Linking.openURL(o.store_url!).catch(() =>
                    setError("Could not open the store link."),
                  )
                }
              />
              <Button
                quiet
                label="Stay on Unmask"
                onPress={() => setLeaving(false)}
              />
            </Card>
          ) : null}
        </>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
    </TodayPage>
  );
}
