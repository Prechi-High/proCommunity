import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import {
  ArrowSquareOut,
  ChatCircle,
  MagnifyingGlass,
  Sparkle,
} from "@/components/icons";
import {
  askUnmaskFromEdge,
  type AskUnmaskApiAnswer,
} from "@/lib/services/ask/askUnmask";
import { dimensions } from "./data";
import { getUIContract } from "@/lib/product-result/contract";
import { fetchThreads } from "@/lib/community";
import type { ProductProfile } from "@/lib/types";
import { useRouter, type Href } from "expo-router";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Field,
  Heading,
  LinkRow,
  Notice,
  Pill,
  ink,
  openSource,
  s,
} from "./ui";
export function Questions({
  profile,
  onCommunity,
  initialQuestion = "",
}: {
  profile: ProductProfile;
  onCommunity: (q: string) => void;
  initialQuestion?: string;
}) {
  const r = useRouter();
  const [draft, setDraft] = useState(initialQuestion);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskUnmaskApiAnswer | null>(null);
  const [insufficient, setInsufficient] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const threads = useQuery({
    queryKey: ["threads", profile.id],
    queryFn: () => fetchThreads(profile.id),
  });
  const suggestions = [
    ...dimensions(profile)
      .slice(0, 2)
      .map((d) => ({
        id: d.id,
        question: `How do people describe ${d.label.toLowerCase()}?`,
      })),
    { id: "uncertainty", question: "What concerns come up most?" },
  ];
  const run = async (q: string) => {
    if (!q.trim() || loading) return;
    setDraft(q);
    setQuestion(q);
    setLoading(true);
    setAnswer(null);
    setInsufficient("");
    setError("");
    try {
      const a = await askUnmaskFromEdge({
        productId: profile.id,
        question: q,
        uiContract: getUIContract(profile),
      });
      if (a.kind === "answer") setAnswer(a);
      else
        setInsufficient(
          a.hint || "No relevant answer was found in the available evidence.",
        );
    } catch {
      setError("The evidence service is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  if (question) {
    const claims =
      profile.findings?.claims.filter((c) => c.claimOrigin === "brand") || [];
    return (
      <>
        <Heading>Your question</Heading>
        <Notice>{question}</Notice>
        <Busy loading={loading} />
        {error ? <Notice>{error}</Notice> : null}
        {answer || insufficient ? (
          <Card>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Heading>Unmask answer</Heading>
              <Pill>
                {answer ? "Evidence-based answer" : "Needs more evidence"}
              </Pill>
            </View>
            <Copy>{answer?.shortAnswer || insufficient}</Copy>
            {answer?.evidence.map((e, i) => {
              const source = profile.sources.find(
                (s) =>
                  s.url === e.origin ||
                  s.domain === e.origin ||
                  s.title === e.origin,
              );
              return (
                <Card key={i} style={{ backgroundColor: ink.soft }}>
                  <Text style={s.eyebrow}>
                    {/brand|company|official/i.test(e.origin)
                      ? "COMPANY INFORMATION"
                      : "EXTERNAL SOURCES"}
                  </Text>
                  <Copy>{e.summary}</Copy>
                  <Copy small>{e.origin}</Copy>
                  {source || /^https?:/.test(e.origin) ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => openSource(source?.url || e.origin)}
                    >
                      <Text style={{ color: ink.brand }}>
                        View source <ArrowSquareOut size={14} />
                      </Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            })}
            {!answer?.evidence.length && claims[0] ? (
              <Card>
                <Text style={s.eyebrow}>COMPANY INFORMATION</Text>
                <Copy>{claims[0].brandStatement}</Copy>
                <Copy small>
                  Company claims do not establish individual outcomes.
                </Copy>
              </Card>
            ) : null}
            <Card style={{ backgroundColor: ink.soft }}>
              <Text style={s.eyebrow}>WHAT REMAINS UNKNOWN</Text>
              <Copy>
                How it will perform with your own context and routine.
              </Copy>
            </Card>
          </Card>
        ) : null}
        <Copy small>
          Sources are linked when returned by the evidence service so you can
          check the context yourself.
        </Copy>
        <Card>
          <Heading>Need a more personal answer?</Heading>
          <Copy muted>
            You can share this question with the community. Nothing is posted
            until you review it.
          </Copy>
          <Button
            label="Prepare community question"
            onPress={() => onCommunity(question)}
          />
        </Card>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Field
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask a follow-up…"
            />
          </View>
          <Button
            label="Ask"
            onPress={() => void run(draft)}
            disabled={loading || !draft.trim()}
          />
        </View>
        <Button
          quiet
          label="Back to product questions"
          onPress={() => {
            setQuestion("");
            setDraft("");
          }}
        />
      </>
    );
  }
  const qs = (threads.data || [])
    .filter((x) => x.kind === "question")
    .filter(
      (x) =>
        filter === "All" ||
        (filter === "Answered" ? x.reply_count > 0 : x.reply_count === 0),
    );
  return (
    <>
      <Heading hero>Questions about this product</Heading>
      <Copy muted>Get an answer grounded in the evidence available.</Copy>
      <Card>
        <Heading>Ask Unmask</Heading>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Field
              value={draft}
              onChangeText={setDraft}
              placeholder="Type your question…"
            />
          </View>
          <Button
            label="Ask"
            onPress={() => void run(draft)}
            disabled={!draft.trim()}
          />
        </View>
        <Copy small>
          Answers include source links and show what remains unknown.
        </Copy>
        <View style={{ gap: 8 }}>
          {suggestions.slice(0, 2).map((x) => (
            <Pressable
              key={x.id}
              onPress={() => void run(x.question)}
              style={[
                s.row,
                { backgroundColor: ink.soft, padding: 10, borderRadius: 99 },
              ]}
            >
              <MagnifyingGlass size={18} color={ink.brand} />
              <Copy>{x.question}</Copy>
            </Pressable>
          ))}
        </View>
      </Card>
      <Heading>Questions people are asking</Heading>
      <Chips
        options={["All", "Answered", "Needs more evidence"]}
        value={filter}
        onChange={setFilter}
      />
      <Busy
        loading={threads.isLoading}
        error={threads.error}
        retry={() => void threads.refetch()}
      />
      {qs.map((t) => (
        <LinkRow
          key={t.id}
          label={t.title}
          icon={<ChatCircle size={20} color={ink.brand} />}
          onPress={() => r.push(`/thread/${t.id}?unmask=1` as Href)}
        />
      ))}
      {!qs.length && !threads.isLoading ? (
        <Copy muted>No community questions match this view yet.</Copy>
      ) : null}
      <Notice>
        When Unmask can’t answer from available evidence, you can choose to ask
        the community.
      </Notice>
      <Button
        quiet
        label="How community questions work"
        onPress={() => onCommunity(draft)}
      />
    </>
  );
}
