import { useState } from "react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import {
  ActionStatus,
  Body,
  Button,
  Busy,
  Card,
  Choices,
  Empty,
  Field,
  Page,
  ProductTile,
  Tag,
  Title,
  useAction,
  useLivingQuery,
} from "@/components/living/ui";
import { ExperienceCard } from "@/components/living/ExperienceCard";
import { FollowButton } from "@/components/living/FollowButton";
export default function ProductWatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const cat = useLivingQuery(["catalog", id], () => api.catalog(id));
  const feed = useLivingQuery(["product-feed", id], () =>
    api.experiences({ productId: id }),
  );
  const qs = useLivingQuery(["product-questions", id], () => api.questions(id));
  const mine = useLivingQuery(["journeys"], api.journeys, !!uid);
  const [stage, setStage] = useState("all");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const action = useAction();
  const p = cat.data?.[0];
  const own = mine.data?.find((j) => j.product_id === id);
  const items = feed.data?.filter(
    (x) => stage === "all" || x.maturity === stage,
  );
  return (
    <Page
      back
      eyebrow="The living product record"
      title={p?.name || "Product story"}
      sub="Claims are the beginning. The useful story is what happens next."
    >
      <Busy loading={cat.isLoading} error={cat.error} />
      {p ? (
        <>
          <ProductTile
            name={p.name}
            brand={p.brand}
            image={p.image_url}
            detail="Open the full product investigation"
            onPress={() =>
              r.push({
                pathname: "/product/[id]",
                params: { id, q: p.name },
              } as Href)
            }
          />
          {p.company_id ? (
            <Button
              quiet
              label={`About ${p.brand || "the company"} →`}
              onPress={() =>
                r.push(`/company/${encodeURIComponent(p.company_id!)}` as Href)
              }
            />
          ) : null}
          <FollowButton type="product" id={id} preferences />
          <Button
            label={
              own ? "Continue my journey" : "I own this · start my journey"
            }
            onPress={() =>
              r.push(
                (own
                  ? `/journey/${own.id}`
                  : `/journey/new?product=${encodeURIComponent(id)}`) as Href,
              )
            }
          />
          <Card tone="gold">
            <Tag text="EVIDENCE IS STILL DEVELOPING" />
            <Body>
              YouTube comments and other external sources remain available in
              the full investigation. Native experiences below show reported
              usage, documented history and acquisition disclosure separately.
            </Body>
            <Body>
              Possession does not establish independence. There is no automatic
              score boost for being an Unmask member.
            </Body>
          </Card>
          <Title>Experience timeline</Title>
          <Choices
            value={stage}
            onChange={setStage}
            options={[
              { id: "all", label: "All stages" },
              { id: "early", label: "Early" },
              { id: "established", label: "Established" },
              { id: "long_term", label: "Long-term" },
            ]}
          />
          <Busy
            loading={feed.isLoading}
            error={feed.error}
            retry={() => void feed.refetch()}
          />
          {items?.map((e) => (
            <ExperienceCard key={e.id} item={e} productLink={false} />
          ))}
          {items?.length === 0 ? (
            <Empty
              title="This chapter is still being written."
              body="There are no shared native experiences at this stage yet. That is a gap in evidence, not proof of a good or bad outcome."
            />
          ) : null}
          <Title>Ask someone who has used it</Title>
          <Card>
            <Field
              label="Your question"
              value={question}
              onChange={setQuestion}
              multiline
              placeholder="What would you like to understand?"
            />
            <Field
              label="Helpful context (optional)"
              value={context}
              onChange={setContext}
            />
            <Button
              label="Ask the community"
              disabled={question.trim().length < 10 || action.isPending}
              onPress={() =>
                action.run(async () => {
                  const q = await api.addQuestion({
                    product_id: id,
                    body: question,
                    context,
                  });
                  setQuestion("");
                  r.push(`/question/${q.id}` as Href);
                })
              }
            />
            <ActionStatus action={action} />
          </Card>
          {qs.data?.map((q) => (
            <Card key={q.id}>
              <Body>{q.body}</Body>
              <Button
                quiet
                label="Read & answer"
                onPress={() => r.push(`/question/${q.id}` as Href)}
              />
            </Card>
          ))}
        </>
      ) : !cat.isLoading ? (
        <Empty
          title="Product record not available yet."
          body="Open the product investigation to connect its living record."
          action="Search products"
          onPress={() => r.push("/unmask" as Href)}
        />
      ) : null}
    </Page>
  );
}
