import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  TeamGate,
  TeamPage,
  useTeamAction,
  ActionResult,
} from "@/components/team/Page";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import { db } from "@/lib/clarity/api";
import { catalog } from "@/lib/living/api";
import { safeLink } from "@/lib/profiles/api";
import * as api from "@/lib/team/api";
export default function Partnerships() {
  return (
    <TeamGate>
      <Content />
    </TeamGate>
  );
}
function Content() {
  const r = useRouter();
  const action = useTeamAction();
  const q = useQuery({
    queryKey: ["team", "offers"],
    queryFn: () => api.offers(false),
  });
  const products = useQuery({
    queryKey: ["catalog"],
    queryFn: () => catalog(),
  });
  const [id, setId] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState("");
  const [kind, setKind] = useState("Store offer");
  const [description, setDescription] = useState("");
  const [disclosure, setDisclosure] = useState("");
  const [terms, setTerms] = useState("");
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("draft");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false);
  const load = (o: api.Offer) => {
    setId(o.id);
    setSponsor(o.sponsor);
    setTitle(o.title);
    setProduct(o.product_id);
    setKind(o.kind);
    setDescription(o.description);
    setDisclosure(o.disclosure);
    setTerms(o.terms);
    setUrl(o.store_url || "");
    setStart(o.starts_at || "");
    setEnd(o.expires_at || "");
    setStatus(o.status);
    setConfirm(false);
  };
  const save = () =>
    action.mutate(async () => {
      const row = {
        sponsor: sponsor.trim(),
        title: title.trim(),
        product_id: product,
        kind,
        description,
        disclosure,
        terms,
        store_url: url ? safeLink(url) : null,
        status,
        starts_at: api.dateTime(start),
        expires_at: api.dateTime(end),
      };
      if (url && !row.store_url)
        throw new Error("Use a full HTTPS store URL without credentials.");
      const result = await api.read<{ id: string }>(
        id
          ? db()
              .from("unmask_offers")
              .update(row)
              .eq("id", id)
              .select("id")
              .single()
          : db().from("unmask_offers").insert(row).select("id").single(),
      );
      setId(result.id);
      setConfirm(false);
    });
  return (
    <TeamPage title="Business partnerships" tab="Operations">
      <Copy>
        Manage sponsored investigations, retailer offers and experience
        programmes. Sponsorship never changes community findings or evidence
        ranking.
      </Copy>
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data?.map((o) => (
        <Card key={o.id}>
          <Pill>
            {o.kind} · {o.status}
          </Pill>
          <Heading>{o.sponsor}</Heading>
          <Copy>{o.title}</Copy>
          <Button quiet label="Edit offer" onPress={() => load(o)} />
          <Button
            quiet
            label="Preview offer"
            onPress={() => r.push(`/offers/${o.id}` as Href)}
          />
        </Card>
      ))}
      <Card>
        <Heading>{id ? "Edit offer" : "Create offer draft"}</Heading>
        <Field
          label="Sponsor / store name"
          value={sponsor}
          onChange={setSponsor}
        />
        <Field label="Offer title" value={title} onChange={setTitle} />
        <Chips
          options={[
            "Store offer",
            "Sponsored investigation",
            "Experience programme",
          ]}
          value={kind}
          onChange={setKind}
        />
        <Field label="Find product" value={search} onChange={setSearch} />
        <Copy>
          Selected:{" "}
          {products.data?.find((p) => p.id === product)?.name || "None"}
        </Copy>
        <Busy loading={products.isLoading} error={products.error} />
        {products.data
          ?.filter((p) =>
            `${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase()),
          )
          .slice(0, 8)
          .map((p) => (
            <Button
              key={p.id}
              quiet
              label={`${p.id === product ? "●" : "○"} ${p.name}`}
              onPress={() => setProduct(p.id)}
            />
          ))}
        <Field
          label="Seller description (public)"
          multiline
          value={description}
          onChange={setDescription}
        />
        <Field
          label="Commercial disclosure (public, required)"
          multiline
          value={disclosure}
          onChange={setDisclosure}
        />
        <Field
          label="Offer terms (public)"
          multiline
          value={terms}
          onChange={setTerms}
        />
        <Field
          label="Store HTTPS destination (optional)"
          value={url}
          onChange={setUrl}
        />
        <Field
          label="Start time, Lagos (optional)"
          value={start}
          onChange={setStart}
        />
        <Field
          label="Expiry time, Lagos (optional)"
          value={end}
          onChange={setEnd}
        />
        <Chips
          options={["draft", "active", "paused"]}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setConfirm(false);
          }}
        />
        <Notice>
          Public fields must not contain internal contracts or private contacts.
          No guaranteed favorable review or stock authentication is provided.
        </Notice>
        <Button
          disabled={
            action.isPending ||
            sponsor.trim().length < 2 ||
            title.trim().length < 3 ||
            !product ||
            disclosure.trim().length < 10
          }
          label={
            status === "active" ? "Review public offer" : "Save draft / pause"
          }
          onPress={() => (status === "active" ? setConfirm(true) : save())}
        />
        {confirm ? (
          <>
            <Copy>
              This publishes the offer and its disclosure for its active dates.
            </Copy>
            <Button
              disabled={action.isPending}
              label="Confirm active offer"
              onPress={save}
            />
            <Button quiet label="Cancel" onPress={() => setConfirm(false)} />
          </>
        ) : null}
        {id ? (
          <Button
            quiet
            label="Preview saved offer"
            onPress={() => r.push(`/offers/${id}` as Href)}
          />
        ) : null}
      </Card>
      <ActionResult action={action} />
    </TeamPage>
  );
}
