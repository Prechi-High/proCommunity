import { useEffect, useState } from "react";
import { Share, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as api from "@/lib/living/api";
import type { Visibility } from "@/lib/living/types";
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
  visibilityOptions,
  useAction,
  useLivingQuery,
} from "@/components/living/ui";
import { FollowButton } from "@/components/living/FollowButton";
export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const isNew = id === "new";
  const q = useLivingQuery(["routine", id], () => api.routine(id), !isNew);
  const items = useLivingQuery(
    ["routine-items", id],
    () => api.routineItems(id),
    !isNew,
  );
  const events = useLivingQuery(
    ["routine-events", id],
    () => api.routineEvents(id),
    !isNew,
  );
  const qs = useLivingQuery(
    ["routine-questions", id],
    () => api.questions(undefined, id),
    !isNew,
  );
  const mine = useLivingQuery(["journeys"], api.journeys, !!uid);
  const action = useAction();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [time, setTime] = useState("pm");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [event, setEvent] = useState("");
  const [question, setQuestion] = useState("");
  const [product, setProduct] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [editing, setEditing] = useState(isNew);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!q.data) return;
    setName(q.data.name);
    setGoal(q.data.goal || "");
    setContext(q.data.context || "");
    setUncertainty(q.data.uncertainty || "");
    setTime(q.data.time_of_day);
    setVisibility(q.data.visibility);
  }, [q.data]);
  const owner = isNew || uid === q.data?.user_id;
  return (
    <Page
      back
      eyebrow="A routine with a story"
      title={isNew ? "Make room for a routine." : q.data?.name || "Routine"}
      sub="Products, order, context and what changes. A living record you can keep private or share."
    >
      <Busy loading={!isNew && q.isLoading} error={q.error} />
      {!isNew && q.data ? (
        <Card tone="wine">
          <Tag
            text={`${q.data.time_of_day.toUpperCase()} · ${q.data.visibility}`}
            tone="gold"
          />
          <Body light>{q.data.goal || "A routine in progress."}</Body>
          {q.data.context ? <Body light>{q.data.context}</Body> : null}
          {q.data.uncertainty ? (
            <Body light>Still uncertain: {q.data.uncertainty}</Body>
          ) : null}
          <Body light>
            Started {q.data.started_on || "not recorded"} · Updated{" "}
            {new Date(q.data.updated_at).toLocaleDateString()}
          </Body>
          {owner ? (
            <Button
              quiet
              label={editing ? "Close settings" : "Edit routine & privacy"}
              onPress={() => setEditing(!editing)}
            />
          ) : (
            <FollowButton type="routine" id={id} />
          )}
          <Button
            quiet
            label="Share routine"
            onPress={() => {
              if (q.data?.visibility !== "public") {
                setMessage(
                  "Set the routine to Public before sharing a public link.",
                );
                return;
              }
              void Share.share({
                message: `${q.data.name} — a living routine on Unmask`,
                url: `https://dunmasker.vercel.app/routine/${id}`,
              });
            }}
          />
          {message ? <Body light>{message}</Body> : null}
        </Card>
      ) : null}
      {owner && editing ? (
        <Card>
          <Title>{isNew ? "Start your routine" : "Routine settings"}</Title>
          <Field label="Routine name" value={name} onChange={setName} />
          <Choices
            label="When is this routine used?"
            value={time}
            onChange={setTime}
            options={[
              { id: "am", label: "Morning" },
              { id: "pm", label: "Evening" },
              { id: "weekly", label: "Weekly" },
              { id: "travel", label: "Travel" },
              { id: "recovery", label: "Simplified / recovery" },
            ]}
          />
          <Field label="Your goal" value={goal} onChange={setGoal} />
          <Field
            label="Context · skin, sensitivity, climate"
            value={context}
            onChange={setContext}
            multiline
          />
          <Field
            label="What remains uncertain?"
            value={uncertainty}
            onChange={setUncertainty}
          />
          <Choices
            label="Who can see this routine?"
            value={visibility}
            onChange={(v) => setVisibility(v as Visibility)}
            options={visibilityOptions}
          />
          <Button
            label="Save routine"
            disabled={name.trim().length < 2 || action.isPending}
            onPress={() =>
              action.run(async () => {
                const x = await api.saveRoutine({
                  ...(isNew ? {} : { id }),
                  name,
                  goal,
                  context,
                  uncertainty,
                  time_of_day: time,
                  visibility,
                });
                setEditing(false);
                if (isNew) r.replace(`/routine/${x.id}` as Href);
              })
            }
          />
          <ActionStatus action={action} />
        </Card>
      ) : null}
      {!isNew && q.data ? (
        <>
          <Title>Products, in order</Title>
          <Body>
            These are the contributor’s recorded steps, not a medically
            validated compatibility recommendation.
          </Body>
          {items.data?.map((x, i) => (
            <Card key={x.id}>
              <Tag
                text={`STEP ${i + 1}${x.stopped_on ? " · STOPPED" : ""}`}
                tone={x.stopped_on ? "neutral" : "sage"}
              />
              <ProductTile
                name={x.unmask_catalog.name}
                brand={x.unmask_catalog.brand}
                image={x.unmask_catalog.image_url}
                detail={`${x.frequency || "Frequency not recorded"} · Since ${x.started_on || "not recorded"}`}
                onPress={() =>
                  r.push(`/watch/${encodeURIComponent(x.product_id)}` as Href)
                }
              />
              {owner ? (
                <View
                  style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                >
                  <Button
                    quiet
                    label="Move earlier"
                    disabled={i === 0 || action.isPending}
                    onPress={() =>
                      action.run(async () => {
                        const prev = items.data![i - 1];
                        await api.patchRoutineItem(x.id, {
                          step_order: prev.step_order,
                        });
                        await api.patchRoutineItem(prev.id, {
                          step_order: x.step_order,
                        });
                      })
                    }
                  />
                  <Button
                    quiet
                    label={x.stopped_on ? "Resume step" : "Stop this step"}
                    onPress={() =>
                      action.run(() =>
                        api.patchRoutineItem(x.id, {
                          stopped_on: x.stopped_on
                            ? null
                            : new Date().toISOString().slice(0, 10),
                        }),
                      )
                    }
                  />
                </View>
              ) : null}
            </Card>
          ))}
          {items.data?.length === 0 ? (
            <Empty
              title="Start with one product."
              body="Add products from your personal shelf. Arrange them in the order you use them."
            />
          ) : null}
          {owner ? (
            <Card>
              <Title>Add a product</Title>
              <Choices
                value={product}
                onChange={setProduct}
                options={(mine.data || [])
                  .filter(
                    (j) =>
                      !items.data?.some((x) => x.product_id === j.product_id),
                  )
                  .map((j) => ({
                    id: j.product_id,
                    label: j.unmask_catalog?.name || j.product_id,
                  }))}
              />
              {mine.data?.length === 0 ? (
                <Body>
                  Add a product journey first, then return to place it in your
                  routine.
                </Body>
              ) : null}
              <Field
                label="Step frequency"
                value={frequency}
                onChange={setFrequency}
              />
              <Button
                label="Add to routine"
                disabled={!product || action.isPending}
                onPress={() =>
                  action.run(async () => {
                    await api.addRoutineItem({
                      routine_id: id,
                      product_id: product,
                      step_order: (items.data?.length || 0) + 1,
                      frequency,
                    });
                    setProduct("");
                  })
                }
              />
              <ActionStatus action={action} />
            </Card>
          ) : null}
          <Title>What changed over time</Title>
          {owner ? (
            <Card>
              <Field
                label="Routine update · changes, observations and uncertainty"
                value={event}
                onChange={setEvent}
                multiline
              />
              <Button
                label="Record a routine update"
                disabled={event.trim().length < 10 || action.isPending}
                onPress={() =>
                  action.run(async () => {
                    await api.addRoutineEvent(id, event);
                    setEvent("");
                  })
                }
              />
              <ActionStatus action={action} />
            </Card>
          ) : null}
          {events.data?.map((x) => (
            <Card key={x.id}>
              <Tag text={new Date(x.created_at).toLocaleDateString()} />
              <Body>{x.body}</Body>
            </Card>
          ))}
          <Title>Questions about this routine</Title>
          <Card>
            <Field
              label="Ask about this routine"
              value={question}
              onChange={setQuestion}
              multiline
            />
            <Button
              label="Ask a question"
              disabled={question.trim().length < 10 || action.isPending}
              onPress={() =>
                action.run(async () => {
                  const x = await api.addQuestion({
                    routine_id: id,
                    body: question,
                  });
                  setQuestion("");
                  r.push(`/question/${x.id}` as Href);
                })
              }
            />
          </Card>
          {qs.data?.map((x) => (
            <Card key={x.id}>
              <Body>{x.body}</Body>
              <Button
                quiet
                label="Read & answer"
                onPress={() => r.push(`/question/${x.id}` as Href)}
              />
            </Card>
          ))}
        </>
      ) : null}
    </Page>
  );
}
