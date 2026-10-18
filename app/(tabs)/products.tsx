import { useMyMember } from "@/lib/owners";
import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
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
  ProductTile,
  Title,
  ActionStatus,
  useAction,
  useLivingQuery,
} from "@/components/living/ui";
export default function MyProducts() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState(
    section === "requests" ? "requests" : "products",
  );
  const [name, setName] = useState("");
  const action = useAction();
  const verified = useMyMember().data?.owned ?? [];
  const mine = useLivingQuery(["journeys"], api.journeys, !!uid);
  const routines = useLivingQuery(
    ["my-routines"],
    () => api.routines(true),
    !!uid,
  );
  const subs = useLivingQuery(["subscriptions"], api.subscriptions, !!uid);
  const cat = useLivingQuery(["catalog"], () => api.catalog());
  const requests = useLivingQuery(["requests"], api.requests, !!uid);
  return (
    <Page
      eyebrow="Your personal product library"
      title="A history worth keeping."
      sub="What you use, what changed, and what you learned. Your history stays yours."
    >
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button
          label="Find a product to add"
          onPress={() => r.push("/unmask" as Href)}
        />
        <Button
          quiet
          label="Saved & recently viewed"
          onPress={() => r.push("/saved" as Href)}
        />
      </View>
      <Choices
        value={tab}
        onChange={setTab}
        options={[
          { id: "products", label: "My products" },
          { id: "routines", label: "My routines" },
          { id: "watching", label: "Watching" },
          { id: "requests", label: "Requests" },
        ]}
      />
      {!uid ? (
        <Empty
          title="Make room for your story."
          body="Sign in to save product journeys and routines across devices. Investigations remain open to everyone."
          action="Sign in"
          onPress={() => r.push("/(auth)/sign-in")}
        />
      ) : (
        <>
          <Busy
            loading={mine.isLoading || routines.isLoading}
            error={mine.error || routines.error}
            retry={() => {
              void mine.refetch();
              void routines.refetch();
            }}
          />
          {tab === "products" ? (
            <>
              {verified
                .filter(
                  (o) => !mine.data?.some((j) => j.product_id === o.productId),
                )
                .map((o) => (
                  <Card key={o.productId}>
                    <Title>{o.productName}</Title>
                    <Body>
                      You already verified possession. Start a journey to record
                      what happens during use.
                    </Body>
                    <Button
                      quiet
                      label="Start my product history"
                      onPress={() =>
                        action.run(async () => {
                          await api.registerProduct({
                            id: o.productId,
                            name: o.productName,
                            brand: o.brand || "",
                            category: o.category || "",
                            heroImageUrl: o.productImage,
                          });
                          r.push(
                            `/journey/new?product=${encodeURIComponent(o.productId)}` as Href,
                          );
                        })
                      }
                    />
                  </Card>
                ))}
              {mine.data?.map((j) => (
                <ProductTile
                  key={j.id}
                  name={j.unmask_catalog?.name || j.product_id}
                  brand={j.unmask_catalog?.brand}
                  image={j.unmask_catalog?.image_url}
                  detail={`${j.status} · ${j.visibility} · Started ${j.started_on || "not yet"}`}
                  onPress={() => r.push(`/journey/${j.id}` as Href)}
                />
              ))}
              {mine.data?.length === 0 ? (
                <Empty
                  title="Your shelf is ready."
                  body="Open a product and choose ‘I own this’ to start a journey. There is no need to publish anything."
                />
              ) : null}
            </>
          ) : null}
          {tab === "routines" ? (
            <>
              <Button
                label="Create a routine"
                onPress={() => r.push("/routine/new" as Href)}
              />
              {routines.data?.map((x) => (
                <Card key={x.id}>
                  <Title>{x.name}</Title>
                  <Body>{x.goal || "A routine in progress."}</Body>
                  <Body>
                    {x.visibility} · {x.time_of_day.toUpperCase()}
                  </Body>
                  <Button
                    quiet
                    label="Open routine →"
                    onPress={() => r.push(`/routine/${x.id}` as Href)}
                  />
                </Card>
              ))}
              {routines.data?.length === 0 ? (
                <Empty
                  title="More than a checklist."
                  body="Keep product order, frequency and changes together. Share your routine only when you want to."
                />
              ) : null}
            </>
          ) : null}
          {tab === "watching" ? (
            <>
              {subs.data?.map((s) => {
                const p = cat.data?.find((p) => p.id === s.target_id);
                return (
                  <Card key={`${s.target_type}-${s.target_id}`}>
                    <Title>
                      {p?.name ||
                        (s.target_type === "person"
                          ? "Followed Unmasker"
                          : s.target_id)}
                    </Title>
                    <Body>
                      {s.target_type} ·{" "}
                      {s.preferences.join(", ").replace(/_/g, " ")}
                    </Body>
                    <Button
                      quiet
                      label="Open"
                      onPress={() =>
                        r.push(
                          (s.target_type === "product"
                            ? `/watch/${encodeURIComponent(s.target_id)}`
                            : s.target_type === "person"
                              ? `/experiences?person=${s.target_id}`
                              : `/${s.target_type}/${encodeURIComponent(s.target_id)}`) as Href,
                        )
                      }
                    />
                  </Card>
                );
              })}
              {subs.data?.length === 0 ? (
                <Empty
                  title="Follow your curiosity."
                  body="Follow products, people and routines to keep track of meaningful updates."
                />
              ) : null}
            </>
          ) : null}
          {tab === "requests" ? (
            <>
              <Card>
                <Title>Missing a product?</Title>
                <Body>
                  Tell us what you want investigated. Requests are demand
                  signals, not manufactured evidence.
                </Body>
                <Field
                  label="Product name and brand"
                  value={name}
                  onChange={setName}
                />
                <Button
                  label="Request product"
                  disabled={name.trim().length < 2 || action.isPending}
                  onPress={() =>
                    action.run(async () => {
                      await api.requestProduct(name, "");
                      setName("");
                    })
                  }
                />
                <ActionStatus action={action} />
              </Card>
              {requests.data?.map((x) => (
                <Card key={x.id}>
                  <Title>{x.name}</Title>
                  <Body>{x.status}</Body>
                  {x.product_id ? (
                    <Button
                      label="View product"
                      onPress={() => r.push(`/watch/${x.product_id}` as Href)}
                    />
                  ) : null}
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}
