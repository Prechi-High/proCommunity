import { useEffect, useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { TodayPage } from "@/components/today/Page";
import { InvestigationCard } from "@/components/today/InvestigationCard";
import { ProfileIdentity } from "@/components/profiles/Identity";
import { FollowButton } from "@/components/living/FollowButton";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Chips,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import * as community from "@/lib/community-v2/api";
import * as living from "@/lib/living/api";
import * as api from "@/lib/today/api";
import { entrySeen, setup } from "@/lib/entry/api";
import { useAppStore } from "@/lib/store";
export default function Today() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    void entrySeen()
      .then(setSeen)
      .catch(() => setSeen(true));
  }, []);
  useEffect(() => {
    if (seen === false && !uid) r.replace("/welcome");
  }, [seen, uid, r]);
  const prefs = useQuery({
    queryKey: ["entry-setup", uid],
    queryFn: setup,
    enabled: !!uid,
  });
  const [interest, setInterest] = useState("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const videos = useQuery({
    queryKey: ["creator-publications", undefined],
    queryFn: () => community.publications(),
  });
  const creators = useQuery({
    queryKey: ["creators"],
    queryFn: community.creators,
  });
  const requests = useQuery({
    queryKey: ["today-requests", uid, interest],
    queryFn: () => api.browse("", interest, "Most sparked"),
  });
  const subscriptions = useQuery({
    queryKey: ["subscriptions", uid],
    queryFn: living.subscriptions,
    enabled: !!uid,
  });
  const products = (subscriptions.data ?? [])
    .filter((s) => s.target_type === "product")
    .map((s) => s.target_id)
    .sort();
  const updates = useQuery({
    queryKey: ["today-followed-updates", uid, products],
    queryFn: () => api.followedUpdates(products),
    enabled: !!uid && subscriptions.isSuccess,
  });
  const featured = videos.data?.[0];
  const creator = creators.data?.find(
    (c) => c.user_id === featured?.creator_id,
  );
  if (!uid && seen !== true) return null;
  return (
    <TodayPage
      root
      title="A little clarity for today."
      sub="Experiences, questions and investigations worth your attention."
    >
      <Field
        label="Search products, ingredients or topics"
        value={search}
        onChange={setSearch}
      />
      <Button
        quiet
        disabled={search.trim().length < 2}
        label="Search Unmask"
        onPress={() =>
          r.push({ pathname: "/results", params: { q: search.trim() } } as Href)
        }
      />
      {prefs.data?.interests.length ? (
        <>
          <Copy small>Your investigation interests</Copy>
          <Chips
            options={["All", ...prefs.data.interests]}
            value={interest}
            onChange={setInterest}
          />
        </>
      ) : null}
      <Busy
        loading={videos.isLoading}
        error={videos.error}
        retry={() => void videos.refetch()}
      />
      {featured ? (
        <Card>
          {featured.thumbnail_url ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play ${featured.title}`}
              onPress={() =>
                void Linking.openURL(featured.video_url).catch(() =>
                  setError("Could not open this video."),
                )
              }
            >
              <Image
                source={{ uri: featured.thumbnail_url }}
                style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }}
                resizeMode="cover"
              />
            </Pressable>
          ) : null}
          <Heading>{featured.title}</Heading>
          <Pill>Published</Pill>
          {featured.commercial_disclosure ? (
            <Copy small>
              Commercial disclosure: {featured.commercial_disclosure}
            </Copy>
          ) : null}
          <Button
            label="▶ Watch investigation"
            onPress={() =>
              void Linking.openURL(featured.video_url).catch(() =>
                setError("Could not open this video."),
              )
            }
          />
          {creator ? (
            <Button
              quiet
              label={`Unmasked by ${creator.display_name} · View creator`}
              onPress={() => r.push(`/creators?id=${creator.user_id}` as Href)}
            />
          ) : null}
          {featured.product_id ? (
            <Button
              quiet
              label="Explore this product"
              onPress={() => r.push(`/product/${featured.product_id}` as Href)}
            />
          ) : null}
        </Card>
      ) : videos.isSuccess ? (
        <Card>
          <Heading>The first stories are taking shape.</Heading>
          <Copy>
            Published creator investigations will appear here. Explore the
            community’s questions while we build.
          </Copy>
          <Button
            label="Browse investigation requests"
            onPress={() => r.push("/investigation")}
          />
        </Card>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <Card>
        <Heading>From products you follow</Heading>
        {!uid ? (
          <>
            <Copy>
              Sign in and follow products to keep up with public experience
              updates.
            </Copy>
            <Button
              quiet
              label="Sign in"
              onPress={() => r.push("/(auth)/sign-in")}
            />
          </>
        ) : (
          <>
            <Busy
              loading={subscriptions.isLoading || updates.isLoading}
              error={subscriptions.error || updates.error}
              retry={() => {
                void subscriptions.refetch();
                void updates.refetch();
              }}
            />
            {updates.data?.map((u) => (
              <Card key={u.id}>
                <Heading>
                  {u.clarity_experiences.author_name} added an experience update
                </Heading>
                <Copy muted>
                  {u.clarity_experiences.unmask_catalog?.name ||
                    "Product experience"}
                </Copy>
                <Copy>{u.body}</Copy>
                <Copy small>{new Date(u.created_at).toLocaleDateString()}</Copy>
                <Button
                  quiet
                  label="Read the experience"
                  onPress={() =>
                    r.push(
                      `/contribute?experience=${u.clarity_experiences.id}` as Href,
                    )
                  }
                />
              </Card>
            ))}
            {updates.data?.length === 0 ? (
              <Copy>
                {products.length
                  ? "No public updates from these products yet."
                  : "Follow a product to see its experience updates here."}
              </Copy>
            ) : null}
            <Button
              quiet
              label="Explore products"
              onPress={() => r.push("/unmask")}
            />
          </>
        )}
      </Card>
      <Card>
        <Heading>Questions gaining support</Heading>
        <Button
          quiet
          label="Browse requests"
          onPress={() => r.push("/investigation")}
        />
        <Busy
          loading={requests.isLoading}
          error={requests.error}
          retry={() => void requests.refetch()}
        />
        {requests.data
          ?.filter((i) => i.status !== "published")
          .slice(0, 2)
          .map((i) => (
            <InvestigationCard compact key={i.id} item={i} />
          ))}
        {requests.isSuccess &&
        !requests.data?.some((i) => i.status !== "published") ? (
          <Copy>
            No open requests in this selection yet. Bring a question to the
            community.
          </Copy>
        ) : null}
        <Copy small>
          Ordered by combined Spark support. Support does not determine
          findings.
        </Copy>
      </Card>
      <Card>
        <Heading>Meet the Unmask Creators</Heading>
        <Busy
          loading={creators.isLoading}
          error={creators.error}
          retry={() => void creators.refetch()}
        />
        {creators.data?.slice(0, 2).map((c) => (
          <Card key={c.user_id}>
            <ProfileIdentity name={c.display_name} avatar={c.avatar_url} />
            <Copy small>{c.specialties.join(" · ")}</Copy>
            <Button
              quiet
              label="View creator"
              onPress={() => r.push(`/creators?id=${c.user_id}` as Href)}
            />
            {uid !== c.user_id ? (
              <FollowButton type="person" id={c.user_id} />
            ) : null}
          </Card>
        ))}
        {creators.data?.length === 0 ? (
          <Copy>Creator profiles will appear here when published.</Copy>
        ) : null}
        <Button
          quiet
          label="See all creators"
          onPress={() => r.push("/creators")}
        />
      </Card>
      <Button
        quiet
        label="Explore sponsored offers"
        onPress={() => r.push("/offers")}
      />
      <Card>
        <Heading>Have a product experience?</Heading>
        <Copy>Share what happened. Help someone else find clarity.</Copy>
        <Button
          label="Share your experience"
          onPress={() => r.push("/contribute")}
        />
      </Card>
    </TodayPage>
  );
}
