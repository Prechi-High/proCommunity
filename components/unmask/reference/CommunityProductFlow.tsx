import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as clarity from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import type { Product, ProductProfile } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import {
  BottomNav,
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Header,
  Heading,
  Notice,
  Photo,
  Pill,
  s,
} from "./ui";

const tabs = ["Overview", "Evidence", "Claims", "Timelines", "Questions"];
export function CommunityProductFlow({
  product,
  profile,
  loading,
  error,
  retry,
}: {
  product: Product;
  profile: ProductProfile | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((x) => x.profile?.id);
  const [confirmed, setConfirmed] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [skin, setSkin] = useState("All contexts");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const a = useQuery({
    queryKey: ["clarity-product", product.id],
    queryFn: () => clarity.experiences(false, product.id),
    enabled: confirmed,
  });
  const b = useQuery({
    queryKey: ["public-product-experiences", product.id],
    queryFn: () => living.experiences({ productId: product.id }),
    enabled: confirmed,
  });
  const questions = useQuery({
    queryKey: ["product-questions", product.id],
    queryFn: () => living.questions(product.id),
    enabled: confirmed,
  });
  const subs = useQuery({
    queryKey: ["subscriptions"],
    queryFn: living.subscriptions,
    enabled: !!uid && confirmed,
  });
  const following = subs.data?.some(
    (x) => x.target_type === "product" && x.target_id === product.id,
  );
  const accounts = useMemo(
    () => [
      ...(a.data || []).map((e) => ({
        id: e.id,
        author: e.author_name,
        context: e.skin_type || e.context || "Context not stated",
        duration: e.duration,
        body: e.body,
        date: e.created_at,
        route: `/contribute?experience=${encodeURIComponent(e.id)}`,
        group: e.id,
      })),
      ...(b.data || []).map((e) => ({
        id: e.id,
        author: e.author_name,
        context: e.context || "Context not stated",
        duration: e.claimed_days
          ? `${e.claimed_days} days (self-reported)`
          : "Duration not stated",
        body: [e.changed, e.unchanged, e.reaction, e.uncertainty]
          .filter(Boolean)
          .join(" "),
        date: e.created_at,
        route: `/journey/${encodeURIComponent(e.journey_id)}`,
        group: e.journey_id,
      })),
    ],
    [a.data, b.data],
  );
  const contexts = ["All contexts", ...new Set(accounts.map((e) => e.context))];
  const visible = accounts.filter(
    (e) => skin === "All contexts" || e.context === skin,
  );
  const groups = [...new Set(visible.map((e) => e.group))];
  const claims =
    profile?.findings?.claims.filter((c) => c.claimOrigin === "brand") || [];
  const go = (path: string) => r.push(path as Href);
  const ask = (q = "") =>
    go(
      `/product/${encodeURIComponent(product.id)}/ask-community?q=${encodeURIComponent(q)}`,
    );
  const contribute = () =>
    go(`/contribute?product=${encodeURIComponent(product.id)}`);
  const follow = async () => {
    if (!uid) {
      go("/(auth)/sign-in");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await living.registerProduct(product);
      if (following) await living.unfollow("product", product.id);
      else await living.follow("product", product.id);
      await qc.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not update following.",
      );
    } finally {
      setBusy(false);
    }
  };
  const account = (e: (typeof accounts)[number]) => (
    <Card key={e.id}>
      <Pill>Community experience</Pill>
      <Heading>{e.author || "Unmasker"}</Heading>
      <Copy muted>
        {e.context} · {e.duration}
      </Copy>
      <Copy>{e.body}</Copy>
      <Button
        quiet
        label="View experience and replies"
        onPress={() => go(e.route)}
      />
    </Card>
  );
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <Header onBack={() => (r.canGoBack() ? r.back() : go("/unmask"))} />
      <ScrollView contentContainerStyle={s.content}>
        {message ? <Notice>{message}</Notice> : null}
        {!confirmed ? (
          <>
            <Heading hero>Is this your product?</Heading>
            <View style={{ alignItems: "center" }}>
              <Photo
                uri={product.heroImageUrl || profile?.images?.[0]}
                size={240}
              />
            </View>
            <Heading>{product.name}</Heading>
            <Copy muted>{product.brand}</Copy>
            {profile?.identity.size ? (
              <Pill>{profile.identity.size}</Pill>
            ) : null}
            <Card>
              <Copy small>Product description</Copy>
              <Copy>
                {product.description ||
                  "Check the product name, label and size before continuing."}
              </Copy>
            </Card>
            <Busy loading={loading} error={error} retry={retry} />
            {profile?.variants?.length ? (
              <>
                <Heading>Other variants</Heading>
                <Chips
                  options={profile.variants.map((v) => v.label)}
                  value=""
                  onChange={(label) => {
                    const v = profile.variants?.find((v) => v.label === label);
                    if (v) go(`/results?q=${encodeURIComponent(v.query)}`);
                  }}
                />
              </>
            ) : null}
            <Button
              label="Yes, view product"
              onPress={() => setConfirmed(true)}
            />
            <Button
              quiet
              label="Choose another match"
              onPress={() =>
                go(
                  `/results?q=${encodeURIComponent(product.brand || product.name)}`,
                )
              }
            />
          </>
        ) : (
          <>
            <View style={s.row}>
              <Photo
                uri={product.heroImageUrl || profile?.images?.[0]}
                size={110}
              />
              <View style={{ flex: 1, gap: 8 }}>
                <Copy muted>{product.brand}</Copy>
                <Heading>{product.name}</Heading>
                {profile?.identity.size ? (
                  <Copy>{profile.identity.size}</Copy>
                ) : null}
                <Button
                  label={following ? "Following" : "Follow"}
                  disabled={busy}
                  onPress={() => void follow()}
                />
              </View>
            </View>
            <Copy muted>
              {accounts.length} loaded community accounts · Personal
              experiences, not controlled tests
            </Copy>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 18 }}>
                {tabs.map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === t }}
                    onPress={() => setTab(t)}
                    style={{
                      paddingVertical: 14,
                      borderBottomWidth: tab === t ? 3 : 0,
                      borderColor: "#2A0E16",
                    }}
                  >
                    <Text
                      style={[
                        s.body,
                        {
                          color: tab === t ? "#2A0E16" : "#626B7C",
                          fontWeight: tab === t ? "700" : "400",
                        },
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Busy
              loading={a.isLoading || b.isLoading}
              error={a.error || b.error}
              retry={() => {
                void a.refetch();
                void b.refetch();
              }}
            />
            {tab === "Overview" ? (
              <>
                <Heading>What people experienced</Heading>
                <Copy muted>
                  Read firsthand accounts in the context of how people used this
                  product.
                </Copy>
                {accounts.slice(0, 2).map(account)}
                {!accounts.length &&
                !a.isLoading &&
                !b.isLoading &&
                !a.error &&
                !b.error ? (
                  <Notice>
                    No community experiences have been shared for this product
                    yet.
                  </Notice>
                ) : null}
                {profile?.specs?.length ? (
                  <Card>
                    <Heading>Product details</Heading>
                    {profile.specs.map((v, i) => (
                      <View key={i}>
                        <Copy small>{v.label}</Copy>
                        <Copy>{v.value}</Copy>
                      </View>
                    ))}
                  </Card>
                ) : null}
                <Button label="Share experience" onPress={contribute} />
                <Button quiet label="Ask a question" onPress={() => ask()} />
              </>
            ) : null}
            {tab === "Evidence" ? (
              <>
                <Heading>Experiences, with context</Heading>
                <Chips options={contexts} value={skin} onChange={setSkin} />
                {visible.map(account)}
                {!visible.length ? (
                  <Notice>
                    No matching community accounts loaded. Try another context
                    or share your experience.
                  </Notice>
                ) : null}
                <Button label="Share your experience" onPress={contribute} />
              </>
            ) : null}
            {tab === "Claims" ? (
              <>
                <Heading>Promises & what we know</Heading>
                {claims.map((c) => (
                  <Card key={c.id}>
                    <Pill>Manufacturer claim</Pill>
                    <Heading>{c.brandStatement}</Heading>
                    {profile?.sources.find((v) => v.n === c.brandSourceId) ? (
                      <Copy small>
                        {
                          profile.sources.find((v) => v.n === c.brandSourceId)
                            ?.title
                        }
                      </Copy>
                    ) : (
                      <Copy small>
                        Saved claim · Source details unavailable
                      </Copy>
                    )}
                    <Copy>
                      Community accounts provide personal context; they do not
                      establish whether a claim is proven.
                    </Copy>
                    <Button
                      quiet
                      label="Ask about this claim"
                      onPress={() => ask(c.brandStatement)}
                    />
                  </Card>
                ))}
                {!claims.length ? (
                  <Notice>
                    No attributed manufacturer claims are available yet.
                  </Notice>
                ) : null}
              </>
            ) : null}
            {tab === "Timelines" ? (
              <>
                <Heading>Experience over time</Heading>
                <Copy muted>
                  Follow individual journeys, beyond first impressions.
                </Copy>
                {groups.map((group) => (
                  <Card key={group}>
                    {visible
                      .filter((e) => e.group === group)
                      .sort((x, y) => x.date.localeCompare(y.date))
                      .map((e) => (
                        <View
                          key={e.id}
                          style={{
                            borderLeftWidth: 2,
                            borderColor: "#2A0E16",
                            paddingLeft: 16,
                            gap: 8,
                          }}
                        >
                          <Heading>{e.author || "Unmasker"}</Heading>
                          <Copy small>
                            {new Date(e.date).toLocaleDateString()} ·{" "}
                            {e.duration}
                          </Copy>
                          <Copy>{e.body}</Copy>
                          <Button
                            quiet
                            label="View journey"
                            onPress={() => go(e.route)}
                          />
                        </View>
                      ))}
                  </Card>
                ))}
                {!groups.length ? (
                  <Notice>No shared experience timelines yet.</Notice>
                ) : null}
                <Button label="Add your update" onPress={contribute} />
              </>
            ) : null}
            {tab === "Questions" ? (
              <>
                <Heading>What do you want to understand?</Heading>
                <Button label="Ask the community" onPress={() => ask()} />
                <Busy
                  loading={questions.isLoading}
                  error={questions.error}
                  retry={() => void questions.refetch()}
                />
                {questions.data?.map((q) => (
                  <Card key={q.id}>
                    <Heading>{q.body}</Heading>
                    <Copy muted>Asked by {q.author_name || "an Unmasker"}</Copy>
                    {q.context ? <Copy>{q.context}</Copy> : null}
                    <Button
                      quiet
                      label="Read discussion"
                      onPress={() =>
                        go(`/question/${encodeURIComponent(q.id)}`)
                      }
                    />
                  </Card>
                ))}
                {questions.data?.length === 0 ? (
                  <Notice>Be the first to ask about this product.</Notice>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}
