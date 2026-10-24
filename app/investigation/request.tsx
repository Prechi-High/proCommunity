import { useState } from "react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { CommunityPage, Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Photo,
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/investigations/api";
import * as living from "@/lib/living/api";
import * as community from "@/lib/community-v2/api";
import { useAppStore } from "@/lib/store";
export default function Request() {
  const p = useLocalSearchParams<{
    product?: string;
    question?: string;
    experience?: string;
    q?: string;
  }>();
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [title, setTitle] = useState(p.q || "");
  const [concern, setConcern] = useState("");
  const [links, setLinks] = useState("");
  const [selected, setSelected] = useState(p.product || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const products = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  const e = useQuery({
    queryKey: ["clarity-experience", p.experience],
    queryFn: () => community.experience(p.experience!),
    enabled: !!p.experience,
  });
  const product = products.data?.find((x) => x.id === selected);
  const submit = async () => {
    if (!uid) {
      r.push("/(auth)/sign-in");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const out = await api.create({
        title: title.trim(),
        concern: concern.trim(),
        supporting_links: links.trim(),
        product_id: selected || null,
        question_id: p.question || null,
        experience_id: p.experience || null,
      });
      r.replace(`/investigation/${out.id}` as Href);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to submit.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <CommunityPage title="Let’s understand this together.">
      <Busy
        loading={products.isLoading}
        error={products.error}
        retry={() => void products.refetch()}
      />
      {product ? (
        <Card>
          <Photo uri={product.image_url} size={120} />
          <Heading>{product.name}</Heading>
          <Button
            quiet
            label="Change product"
            onPress={() => setSelected("")}
          />
        </Card>
      ) : (
        products.data
          ?.slice(0, 12)
          .map((x) => (
            <Button
              key={x.id}
              quiet
              label={x.name}
              onPress={() => setSelected(x.id)}
            />
          ))
      )}
      {p.experience ? (
        <>
          <Busy
            loading={e.isLoading}
            error={e.error}
            retry={() => void e.refetch()}
          />
          {e.data ? (
            <Card>
              <Copy small>Linked public experience</Copy>
              <Copy>{e.data.body}</Copy>
              {e.data.visibility !== "public" ? (
                <Notice>Only public experiences can be linked.</Notice>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
      <Field
        label="Question to explore"
        value={title}
        onChange={setTitle}
        multiline
      />
      <Field
        label="What would you like us to clarify?"
        value={concern}
        onChange={setConcern}
        multiline
      />
      <Field
        label="Supporting links (optional)"
        value={links}
        onChange={setLinks}
      />
      <Card>
        <Heading>Creator assignment</Heading>
        <Copy>Unmask will assign a creator after selection.</Copy>
        <Button
          quiet
          disabled
          label="Request a particular creator · Coming later"
          onPress={() => {}}
        />
        <Copy small>
          Selection depends on relevance, feasibility and availability.
        </Copy>
      </Card>
      {error ? <Notice>{error}</Notice> : null}
      <Button
        label="Submit request"
        disabled={
          busy ||
          !selected ||
          title.trim().length < 10 ||
          title.length > 500 ||
          (!!e.data && e.data.visibility !== "public")
        }
        onPress={() => void submit()}
      />
      <Copy small>
        No payment required to request an Unmask. Requests are public.
      </Copy>
    </CommunityPage>
  );
}
