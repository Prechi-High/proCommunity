import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { colors as c, fonts as f } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/living/api";
import {
  Body,
  Button,
  Busy,
  Card,
  Empty,
  Page,
  ProductTile,
  Tag,
  Title,
  design,
  useLivingQuery,
} from "@/components/living/ui";
import { ExperienceCard } from "@/components/living/ExperienceCard";
export default function Today() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const profile = useAppStore((s) => s.profile);
  const mine = useLivingQuery(["journeys"], api.journeys, !!uid);
  const feed = useLivingQuery(["feed"], () => api.experiences());
  const updates = useLivingQuery(["activity"], api.activity, !!uid);
  const qs = useLivingQuery(["questions"], () => api.questions());
  const ownIds = new Set(mine.data?.map((j) => j.product_id));
  const relevant = qs.data?.filter(
    (q) => q.user_id !== uid && q.product_id && ownIds.has(q.product_id),
  );
  const due = mine.data?.filter(
    (j) =>
      j.status === "active" &&
      j.started_on &&
      Date.now() - Date.parse(j.started_on) >= 7 * 86400000,
  );
  return (
    <Page
      eyebrow="A little curiosity, every day"
      title={
        profile
          ? `Your story continues, ${profile.displayName.split(" ")[0]}.`
          : "Every product has an after."
      }
      sub="Look beyond the promise. See what happened after people brought it home."
    >
      <Card tone="wine">
        <Tag text="KNOW BEFORE YOU BUY" tone="gold" />
        <Text
          style={{
            fontFamily: f.serif,
            fontSize: 35,
            lineHeight: 40,
            color: c.white,
          }}
        >
          What are you curious about?
        </Text>
        <Body light>
          Search a product or show us its label. Explore the claims, real
          experiences, and what is still unknown.
        </Body>
        <Button
          quiet
          label="Unmask a product →"
          onPress={() => router.push("/unmask" as Href)}
        />
      </Card>
      <View style={[design.row, { flexWrap: "wrap", alignItems: "stretch" }]}>
        <View style={{ flex: 1, minWidth: 230 }}>
          <Card>
            <Tag text="YOUR NEXT CHAPTER" tone="sage" />
            <Title>
              {due?.length ? "What changed?" : "Start with what you use."}
            </Title>
            <Body>
              {due?.length
                ? "Your experience becomes more useful when you return to it. Add an update when you have something new to share."
                : "Keep your products, routines and observations together. You choose what to share."}
            </Body>
            <Button
              quiet
              label={due?.length ? "Update a product" : "My products"}
              onPress={() =>
                router.push(
                  due?.[0]
                    ? (`/journey/${due[0].id}` as Href)
                    : ("/products" as Href),
                )
              }
            />
          </Card>
        </View>
        <View style={{ flex: 1, minWidth: 230 }}>
          <Card tone="gold">
            <Tag text="ONE PRODUCT. MANY EXPERIENCES." />
            <Title>Watch the story unfold.</Title>
            <Body>
              First impressions are only the beginning. Follow a product or
              someone whose context speaks to yours.
            </Body>
            <Button
              quiet
              label="Explore the community"
              onPress={() => router.push("/pulse" as Href)}
            />
          </Card>
        </View>
      </View>
      {uid ? (
        <>
          <Title
            action="View all"
            onPress={() => router.push("/living-notifications" as Href)}
          >
            Worth returning for
          </Title>
          <Busy
            error={updates.error}
            loading={updates.isLoading}
            retry={() => void updates.refetch()}
          />
          {updates.data?.slice(0, 3).map((n) => (
            <Card key={n.id}>
              <Text style={design.label}>{n.kind}</Text>
              <Body>{n.title}</Body>
              {n.body ? <Body>{n.body}</Body> : null}
              <Button
                quiet
                label="Take a look"
                onPress={() => {
                  void api.readActivity(n.id);
                  if (n.route) router.push(n.route as Href);
                }}
              />
            </Card>
          ))}
          {updates.data?.length === 0 ? (
            <Empty
              title="You're up to date."
              body="Meaningful updates from followed products and relevant questions will appear here."
            />
          ) : null}
          <Title>Your current products</Title>
          {mine.data?.slice(0, 3).map((j) => (
            <ProductTile
              key={j.id}
              name={j.unmask_catalog?.name || j.product_id}
              brand={j.unmask_catalog?.brand}
              image={j.unmask_catalog?.image_url}
              detail={`${j.status} · ${j.frequency || "Frequency not set"}`}
              onPress={() => router.push(`/journey/${j.id}` as Href)}
            />
          ))}
          {relevant?.length ? (
            <>
              <Title>Your experience could help</Title>
              {relevant.slice(0, 2).map((q) => (
                <Card key={q.id}>
                  <Tag text="You have used this product" />
                  <Body>{q.body}</Body>
                  <Button
                    label="Answer with your experience"
                    onPress={() => router.push(`/question/${q.id}` as Href)}
                  />
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : null}
      <Title action="Explore all" onPress={() => router.push("/pulse" as Href)}>
        What happened next
      </Title>
      <Busy
        error={feed.error}
        loading={feed.isLoading}
        retry={() => void feed.refetch()}
      />
      {feed.data?.slice(0, 3).map((e) => (
        <ExperienceCard key={e.id} item={e} />
      ))}
      {feed.data?.length === 0 ? (
        <Empty
          title="The next chapter starts with you."
          body="Long-term community stories are still developing. Product investigations continue to include clearly labeled external evidence."
          action="Find a product"
          onPress={() => router.push("/unmask" as Href)}
        />
      ) : null}
    </Page>
  );
}
