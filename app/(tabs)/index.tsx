import { Text, View, useWindowDimensions } from "react-native";
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
  const { width } = useWindowDimensions();
  const uid = useAppStore((s) => s.profile?.id);
  const profile = useAppStore((s) => s.profile);
  const routines = useLivingQuery(["my-routines"], () => api.routines(true), !!uid);
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
      <View style={{ flexDirection: width >= 850 ? "row" : "column", gap: 16 }}>
        <View style={{ flex: 1.5, backgroundColor: c.brandDeep, borderRadius: 24, padding: width >= 760 ? 32 : 24, gap: 20 }}>
          <Tag text="KNOW BEFORE YOU BUY" tone="gold" />
          <Text style={{ fontFamily: f.serif, fontSize: width >= 760 ? 42 : 33, lineHeight: width >= 760 ? 47 : 39, color: c.white }}>A promise is only{`\n`}the beginning.</Text>
          <Body light>See the claims, the experiences and what is still unknown. Start with a product you’re curious about.</Body>
          <Button quiet label="Unmask a product →" onPress={() => router.push("/unmask" as Href)} />
        </View>
        <View style={{ flex: 1, gap: 14 }}>
          <Card><Tag text="YOUR NEXT CHAPTER" tone="sage" /><Title>{due?.length ? "What changed?" : "Start with what you use."}</Title><Body>{due?.length ? "Return to a product journey when you have something new to share." : "Keep your products, routines and observations together. You choose what to share."}</Body><Button quiet label={due?.length ? "Add an update →" : "Open my products →"} onPress={() => router.push(due?.[0] ? `/journey/${due[0].id}` as Href : "/products" as Href)} /></Card>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View style={{ flex: 1, minWidth: 240 }}><Card tone="sage"><Tag text="YOUR DAILY RHYTHM" tone="sage" /><Title>{routines.data?.[0]?.name || "Make space for a routine."}</Title><Body>{routines.data?.[0]?.goal || "What you use together matters. Keep product order, frequency and changes in one place."}</Body><Button quiet label={routines.data?.length ? "Open routine →" : "Explore my routines →"} onPress={() => router.push(routines.data?.[0] ? `/routine/${routines.data[0].id}` as Href : "/products?section=routines" as Href)} /></Card></View>
        <View style={{ flex: 1, minWidth: 240 }}><Card tone="gold"><Tag text="THE EVENING EDIT" /><Title>A little curiosity. No pressure.</Title><Body>Settle in with recent routine updates. Ask what changed, follow a product story, or simply read.</Body><Button quiet label="Visit the evening community →" onPress={() => router.push("/pulse?section=evening" as Href)} /></Card></View>
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
