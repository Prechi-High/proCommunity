import { Field } from "@/components/community-v2/ui";
import { useState } from "react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityPage } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Photo,
} from "@/components/unmask/reference/ui";
import * as living from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import { getKnownProduct } from "@/lib/products";
export default function Ask() {
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const product = getKnownProduct(id);
  const [body, setBody] = useState(q || "");
  const [details, setDetails] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = useQuery({
    queryKey: ["product-questions", id],
    queryFn: () => living.questions(id),
  });
  const post = async () => {
    if (!uid) {
      r.push("/(auth)/sign-in");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (product) await living.registerProduct(product);
      const out = await living.addQuestion({
        product_id: id,
        body: body.trim(),
        context: [details.trim(), context.trim()].filter(Boolean).join("\n\n"),
      });
      await qc.invalidateQueries({ queryKey: ["product-questions", id] });
      await qc.invalidateQueries({ queryKey: ["community-questions"] });
      r.replace(`/question/${out.id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to post.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <CommunityPage title="Someone here may have experience.">
      <Card>
        {product?.heroImageUrl ? (
          <Photo uri={product.heroImageUrl} size={90} />
        ) : null}
        <Heading>{product?.name || id.replace(/-/g, " ")}</Heading>
      </Card>
      <Field label="Your question" value={body} onChange={setBody} multiline />
      <Field
        label="Details (optional)"
        value={details}
        onChange={setDetails}
        multiline
      />
      <Field
        label="Context to share (optional)"
        value={context}
        onChange={setContext}
      />
      <Heading>Existing questions</Heading>
      <Busy
        loading={existing.isLoading}
        error={existing.error}
        retry={() => void existing.refetch()}
      />
      {existing.data?.slice(0, 3).map((x) => (
        <Card key={x.id}>
          <Copy>{x.body}</Copy>
          <Button
            quiet
            label="View question"
            onPress={() => r.push(`/question/${x.id}` as Href)}
          />
        </Card>
      ))}
      {error ? <Notice>{error}</Notice> : null}
      <Button
        label="Post question"
        disabled={busy || body.trim().length < 10 || body.length > 2000}
        onPress={() => void post()}
      />
      <Copy small>
        Community replies are personal accounts. Your private profile context is
        not attached automatically.
      </Copy>
    </CommunityPage>
  );
}
