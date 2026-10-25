import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
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
  Notice,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import { displayName } from "@/lib/products";
import * as api from "@/lib/utilities/api";
export default function SavedItems() {
  const r = useRouter();
  const path = usePathname();
  const qc = useQueryClient();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = useAppStore((s) => s.profile?.id);
  const favorites = useAppStore((s) => s.favorites);
  const known = useAppStore((s) => s.knownProducts);
  const toggle = useAppStore((s) => s.toggleFavorite);
  const q = useQuery({
    queryKey: ["bookmarks", uid],
    queryFn: api.bookmarks,
    enabled: !!uid,
  });
  const products = favorites.map((f) => ({
    id: f.productId,
    type: "Products",
    title: known[f.productId]
      ? displayName(known[f.productId])
      : "Saved product",
    body: known[f.productId]?.description || "",
    image: known[f.productId]?.heroImageUrl,
    route: `/product/${f.productId}`,
    bookmark: null as api.Bookmark | null,
  }));
  const stories = (q.data ?? []).map((b) => ({
    id: b.id,
    type: b.investigation_id ? "Investigations" : "Experiences",
    title:
      b.unmask_investigations?.title ||
      b.clarity_experiences?.author_name ||
      "Item no longer available",
    body: b.unmask_investigations?.concern || b.clarity_experiences?.body || "",
    image: null,
    route: b.investigation_id
      ? `/investigation/${b.investigation_id}`
      : `/contribute?experience=${b.experience_id}`,
    bookmark: b,
  }));
  const rows = [...products, ...stories].filter(
    (x) =>
      (tab === "All" || x.type === tab) &&
      `${x.title} ${x.body}`.toLowerCase().includes(search.toLowerCase()),
  );
  const remove = async (x: (typeof rows)[number]) => {
    if (!x.bookmark) {
      toggle(x.id);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.toggleBookmark(
        x.bookmark.investigation_id ? "investigation" : "experience",
        x.bookmark.investigation_id || x.bookmark.experience_id!,
        x.bookmark.id,
      );
      await qc.invalidateQueries({ queryKey: ["bookmarks", uid] });
    } catch {
      setError("Could not remove saved item. Retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <UtilityPage
      hideNav={path === "/saved"}
      title="Worth coming back to."
      sub="Your saved products, investigations and experiences, all in one place."
    >
      <Field label="Search saved items" value={search} onChange={setSearch} />
      <Chips
        options={["All", "Products", "Investigations", "Experiences"]}
        value={tab}
        onChange={setTab}
      />
      {uid ? (
        <Busy
          loading={q.isLoading}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : (
        <Copy small>
          Sign in to save investigations and experiences. Product saves on this
          device remain available.
        </Copy>
      )}
      {error ? <Notice>{error}</Notice> : null}
      {rows.map((x) => (
        <Card key={`${x.type}-${x.id}`}>
          <Pill>{x.type.slice(0, -1)}</Pill>
          {x.image ? <Photo uri={x.image} size={120} /> : null}
          <Heading>{x.title}</Heading>
          <Copy>{x.body}</Copy>
          <Button
            label="Open saved item"
            onPress={() => r.push(x.route as Href)}
          />
          <Button
            quiet
            disabled={busy}
            label="▣ Remove from saved"
            onPress={() => void remove(x)}
          />
        </Card>
      ))}
      {rows.length === 0 && !q.isLoading ? (
        <Card>
          <Heading>Nothing here yet.</Heading>
          <Copy>
            Save products, investigations or experiences to return to them
            later.
          </Copy>
          <Button label="Explore Unmask" onPress={() => r.push("/unmask")} />
        </Card>
      ) : null}
    </UtilityPage>
  );
}
