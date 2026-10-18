import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import {
  Body,
  Button,
  Busy,
  Card,
  Choices,
  Empty,
  Field,
  Page,
  Title,
  useLivingQuery,
} from "@/components/living/ui";
import { ExperienceCard } from "@/components/living/ExperienceCard";
import { RoutineCard } from "@/components/living/RoutineCard";
import { FollowButton } from "@/components/living/FollowButton";
export default function Community() {
  const r = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const uid = useAppStore((s) => s.profile?.id);
  const [tab, setTab] = useState("stories");
  useEffect(() => { if (section && ["stories", "following", "routines", "questions", "evening"].includes(section)) setTab(section); }, [section]);
  const [context, setContext] = useState("");
  const feed = useLivingQuery(["feed"], () => api.experiences());
  const routines = useLivingQuery(["public-routines"], () => api.routines());
  const questions = useLivingQuery(["questions"], () => api.questions());
  const subs = useLivingQuery(["subscriptions"], api.subscriptions, !!uid);
  const mine = useLivingQuery(["journeys"], api.journeys, !!uid);
  const personIds = new Set(
    subs.data
      ?.filter((s) => s.target_type === "person")
      .map((s) => s.target_id),
  );
  const productIds = new Set(
    subs.data
      ?.filter((s) => s.target_type === "product")
      .map((s) => s.target_id),
  );
  const ownIds = new Set(mine.data?.map((j) => j.product_id));
  let items = feed.data || [];
  if (tab === "following")
    items = items.filter(
      (e) => personIds.has(e.user_id) || productIds.has(e.product_id),
    );
  if (context.trim())
    items = items.filter((e) =>
      e.context?.toLowerCase().includes(context.toLowerCase()),
    );
  return (
    <Page
      eyebrow="One product. Many experiences."
      title={
        tab === "evening"
          ? "Settle in. What changed?"
          : "The story after the sale."
      }
      sub="Real routines. Honest updates. Questions only experience can answer."
    >
      <Choices
        value={tab}
        onChange={setTab}
        options={[
          { id: "stories", label: "Experiences" },
          { id: "following", label: "Following" },
          { id: "routines", label: "Routines" },
          { id: "questions", label: "Questions" },
          { id: "evening", label: "Evening" },
        ]}
      />
      {tab === "evening" ? (
        <Card tone="wine">
          <Body light>
            A quiet space to catch up on what people are using. Share something
            useful, ask a question, or simply read. There is no streak to keep.
          </Body>
        </Card>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button
          label="Share an experience"
          onPress={() => r.push("/products" as Href)}
        />
        <Button
          quiet
          label="All discussions"
          onPress={() => r.push("/discussions" as Href)}
        />
      </View>
      {tab === "evening" ? (
        <>
          <Title>Evening routines</Title>
          {routines.data
            ?.filter((x) => x.time_of_day === "pm")
            .slice(0, 4)
            .map((x) => (
              <RoutineCard key={x.id} routine={x} follow />
            ))}
          {routines.data?.filter((x) => x.time_of_day === "pm").length === 0 ? (
            <Body>
              There are no public evening routines yet. Shared routines will
              appear here as the community grows.
            </Body>
          ) : null}
        </>
      ) : null}
      {["stories", "following", "evening"].includes(tab) ? (
        <>
          <Field
            label="Find similar context"
            value={context}
            onChange={setContext}
            placeholder="e.g. dry skin, sensitive, humid climate"
          />
          <Busy
            loading={feed.isLoading}
            error={feed.error}
            retry={() => void feed.refetch()}
          />
          {items.map((e) => (
            <ExperienceCard key={e.id} item={e} />
          ))}
          {!feed.isLoading && !items.length ? (
            <Empty
              title="Evidence takes time."
              body="There are no shared experiences matching this view yet. External product research is still available in Unmask."
              action="Investigate a product"
              onPress={() => r.push("/unmask" as Href)}
            />
          ) : null}
        </>
      ) : null}
      {tab === "routines" ? (
        <>
          <Busy loading={routines.isLoading} error={routines.error} />
          {routines.data?.map((x) => (
            <RoutineCard key={x.id} routine={x} follow />
          ))}
          {routines.data?.length === 0 ? (
            <Empty
              title="Living routines belong here."
              body="Public routines will show their goals, product order and changes over time."
            />
          ) : null}
        </>
      ) : null}
      {tab === "questions" ? (
        <>
          <Busy loading={questions.isLoading} error={questions.error} />
          {questions.data?.map((q) => (
            <Card key={q.id}>
              <Title>{q.body}</Title>
              <Body>
                {q.author_name} ·{" "}
                {q.context || "Open to people with relevant experience"}
              </Body>
              {q.product_id && ownIds.has(q.product_id) ? (
                <Body>
                  You have a journey for this product. Your experience may help.
                </Body>
              ) : null}
              <Button
                quiet
                label="Read & answer"
                onPress={() => r.push(`/question/${q.id}` as Href)}
              />
            </Card>
          ))}
          {questions.data?.length === 0 ? (
            <Empty
              title="Ask someone who has used it."
              body="Open a product or routine to ask a specific question. Relevant product users can then find it."
            />
          ) : null}
        </>
      ) : null}
    </Page>
  );
}
