import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { CommunityPage } from "@/components/community-v2/ui";
import { Creators } from "@/components/community-v2/Creators";
import { ExperienceCard } from "@/components/clarity/ExperienceCard";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
export default function Community() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [tab, setTab] = useState("For you");
  const feed = useQuery({
    queryKey: ["clarity-feed"],
    queryFn: () => api.experiences(),
  });
  const questions = useQuery({
    queryKey: ["community-questions"],
    queryFn: () => living.questions(),
  });
  const follows = useQuery({
    queryKey: ["subscriptions", uid],
    queryFn: living.subscriptions,
    enabled: !!uid,
  });
  const followed = new Set(follows.data?.map((x) => x.target_id));
  const rows = (feed.data || []).filter(
    (e) =>
      tab !== "Following" ||
      followed.has(e.user_id) ||
      followed.has(e.product_id),
  );
  return (
    <CommunityPage
      back={false}
      title="Among fellow Unmaskers"
      sub="Real experiences. Honest questions. Clarity, together."
    >
      <Chips
        options={["For you", "Following", "Questions"]}
        value={tab}
        onChange={setTab}
      />
      <Button
        label="Share experience"
        onPress={() => r.push("/contribute" as Href)}
      />
      <Button
        quiet
        label="Ask a question"
        onPress={() => r.push("/ask-community" as Href)}
      />
      <Button
        quiet
        label="Browse investigations"
        onPress={() => r.push("/investigation" as Href)}
      />
      <Heading>Discover Creators</Heading>
      <Creators compact />
      {tab === "Following" && !uid ? (
        <Button
          label="Sign in to see your following feed"
          onPress={() => r.push("/(auth)/sign-in")}
        />
      ) : null}
      <Busy
        loading={feed.isLoading || questions.isLoading}
        error={feed.error || questions.error}
        retry={() => {
          void feed.refetch();
          void questions.refetch();
        }}
      />
      {tab !== "Questions"
        ? rows.map((e) => <ExperienceCard key={e.id} item={e} />)
        : null}
      {(questions.data || [])
        .filter(
          (q) =>
            tab !== "Following" ||
            followed.has(q.user_id) ||
            (!!q.product_id && followed.has(q.product_id)),
        )
        .map((q) => (
          <Card key={q.id}>
            <Heading>{q.body}</Heading>
            <Button quiet label={q.author_name} onPress={() => r.push(`/member/${q.user_id}` as Href)} />
            {q.context ? <Copy>{q.context}</Copy> : null}
            <Button
              quiet
              label="Join discussion"
              onPress={() => r.push(`/question/${q.id}` as Href)}
            />
          </Card>
        ))}
      {feed.data && !rows.length && tab !== "Questions" ? (
        <Notice>
          No matching experiences yet. You can start the conversation.
        </Notice>
      ) : null}
    </CommunityPage>
  );
}
