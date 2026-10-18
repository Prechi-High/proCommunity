import { DateField } from "@/components/living/DateField";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as api from "@/lib/living/api";
import type { ProductState, Visibility } from "@/lib/living/types";
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
  Title,
  acquisitionOptions,
  stateOptions,
  visibilityOptions,
  useAction,
  useLivingQuery,
} from "@/components/living/ui";
import { ExperienceCard } from "@/components/living/ExperienceCard";
export default function JourneyScreen() {
  const { id, product } = useLocalSearchParams<{
    id: string;
    product?: string;
  }>();
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const isNew = id === "new";
  const q = useLivingQuery(
    ["journey", id],
    () => api.journey(id),
    !isNew && !!uid,
  );
  const cat = useLivingQuery(
    ["catalog", product],
    () => api.catalog(product),
    isNew && !!product,
  );
  const feed = useLivingQuery(
    ["journey-updates", id],
    () => api.experiences({ journeyId: id }),
    !isNew && !!uid,
  );
  const action = useAction();
  const [acquisition, setAcquisition] = useState("purchased");
  const [started, setStarted] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState("Once daily");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [status, setStatus] = useState<ProductState>("active");
  const [reason, setReason] = useState("");
  const [replacement, setReplacement] = useState("");
  const [changed, setChanged] = useState("");
  const [unchanged, setUnchanged] = useState("");
  const [reaction, setReaction] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [rebuy, setRebuy] = useState("undecided");
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const all = useLivingQuery(["catalog"], () => api.catalog());
  useEffect(() => {
    if (!q.data) return;
    setAcquisition(q.data.acquisition);
    setStarted(q.data.started_on || "");
    setFrequency(q.data.frequency || "");
    setGoal(q.data.goal || "");
    setContext(q.data.context || "");
    setVisibility(q.data.visibility);
    setStatus(q.data.status);
    setReason(q.data.stop_reason || "");
    setReplacement(q.data.replacement_id || "");
  }, [q.data]);
  const p = q.data?.unmask_catalog || cat.data?.[0];
  const datesValid =
    !started ||
    (/^\d{4}-\d{2}-\d{2}$/.test(started) &&
      !Number.isNaN(Date.parse(started)) &&
      Date.parse(started) <= Date.now());
  const save = () =>
    action.run(async () => {
      if (!datesValid)
        throw new Error(
          "Use a valid start date, YYYY-MM-DD, today or earlier.",
        );
      const row = {
        product_id: p!.id,
        acquisition,
        started_on: started || null,
        frequency,
        goal,
        context,
        visibility,
        status,
        stop_reason: reason || null,
        stopped_on: ["stopped", "finished", "replaced"].includes(status)
          ? new Date().toISOString().slice(0, 10)
          : null,
        replacement_id: replacement || null,
      };
      const j = await api.saveJourney(row);
      setMessage("Your journey is saved.");
      if (isNew) r.replace(`/journey/${j.id}` as Href);
    });
  return (
    <Page
      back
      eyebrow="Your experience, over time"
      title={p?.name || "Start a product journey"}
      sub="A first impression is a beginning. Keep the rest of the story, too."
    >
      {!uid ? (
        <Empty
          title="Keep your history."
          body="Sign in to create a private product journey."
          action="Sign in"
          onPress={() => r.push("/(auth)/sign-in")}
        />
      ) : (
        <>
          <Busy loading={!isNew && q.isLoading} error={q.error || cat.error} />
          {p ? (
            <>
              <Card>
                <Title>
                  {isNew ? "Start your story" : "Your product context"}
                </Title>
                <Choices
                  label="How did you obtain it?"
                  options={acquisitionOptions}
                  value={acquisition}
                  onChange={setAcquisition}
                />
                <DateField
                  label="When did you start using it?"
                  value={started}
                  onChange={setStarted}
                />
                <Field
                  label="How often do you use it?"
                  value={frequency}
                  onChange={setFrequency}
                />
                <Field
                  label="What are you using it for?"
                  value={goal}
                  onChange={setGoal}
                />
                <Field
                  label="Your context · skin type, sensitivity, climate, other products"
                  value={context}
                  onChange={setContext}
                  multiline
                />
                <Choices
                  label="Product status"
                  options={stateOptions}
                  value={status}
                  onChange={(v) => setStatus(v as ProductState)}
                />
                {["paused", "stopped", "replaced"].includes(status) ? (
                  <Field
                    label="Why did you pause or stop?"
                    value={reason}
                    onChange={setReason}
                    multiline
                  />
                ) : null}
                {status === "replaced" ? (
                  <Choices
                    label="Replacement product"
                    options={(all.data || [])
                      .filter((x) => x.id !== p.id)
                      .slice(0, 25)
                      .map((x) => ({ id: x.id, label: x.name }))}
                    value={replacement}
                    onChange={setReplacement}
                  />
                ) : null}
                <Choices
                  label="Who can see this journey?"
                  options={visibilityOptions}
                  value={visibility}
                  onChange={(v) => setVisibility(v as Visibility)}
                />
                <Body>
                  Only shared updates from a shared journey can become community
                  evidence. Starting earlier does not create earlier documented
                  history.
                </Body>
                <Button
                  label={isNew ? "Start my journey" : "Save journey settings"}
                  disabled={!datesValid || action.isPending}
                  onPress={save}
                />
                {message ? <Body>{message}</Body> : null}
                <ActionStatus action={action} />
              </Card>
              {!isNew ? (
                <>
                  <Card>
                    <Title>What happened next?</Title>
                    <Body>
                      Be specific. Positive, negative, mixed and unchanged
                      experiences are all useful. New updates preserve your
                      previous observations.
                    </Body>
                    <Field
                      label="What changed?"
                      value={changed}
                      onChange={setChanged}
                      multiline
                    />
                    <Field
                      label="What did not change?"
                      value={unchanged}
                      onChange={setUnchanged}
                      multiline
                    />
                    <Field
                      label="Any irritation or other reaction?"
                      value={reaction}
                      onChange={setReaction}
                      multiline
                    />
                    <Field
                      label="What are you still uncertain about?"
                      value={uncertainty}
                      onChange={setUncertainty}
                    />
                    <Choices
                      label="Would you buy it again?"
                      value={rebuy}
                      onChange={setRebuy}
                      options={[
                        { id: "yes", label: "Yes" },
                        { id: "no", label: "No" },
                        { id: "undecided", label: "Not sure yet" },
                      ]}
                    />
                    <Button
                      quiet
                      label={
                        photo
                          ? "Change supporting photo"
                          : "Add a supporting photo"
                      }
                      onPress={() => {
                        void ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ["images"],
                          quality: 0.7,
                        }).then((x) => {
                          if (!x.canceled) setPhoto(x.assets[0].uri);
                        });
                      }}
                    />
                    {photo ? (
                      <>
                        <Image
                          source={{ uri: photo }}
                          style={{
                            height: 170,
                            width: "100%",
                            borderRadius: 12,
                          }}
                        />
                        <Button
                          quiet
                          label="Remove photo"
                          onPress={() => setPhoto(null)}
                        />
                      </>
                    ) : null}
                    <Body>
                      {visibility === "private"
                        ? "This update stays private."
                        : `This update will be visible to ${visibility === "public" ? "everyone" : "your followers"}. Save journey settings first if you changed its visibility.`}
                    </Body>
                    <Button
                      label="Add my experience"
                      disabled={changed.trim().length < 10 || action.isPending}
                      onPress={() =>
                        action.run(async () => {
                          let path: string | null = null;
                          try {
                            if (photo) path = await api.uploadPhoto(photo);
                            await api.addExperience({
                              journey_id: id,
                              changed: changed.trim(),
                              unchanged,
                              reaction,
                              uncertainty,
                              would_rebuy:
                                rebuy === "undecided" ? null : rebuy === "yes",
                              visibility: q.data!.visibility,
                              photo_path: path,
                            });
                          } catch (err) {
                            throw err;
                          }
                          setChanged("");
                          setUnchanged("");
                          setReaction("");
                          setUncertainty("");
                          setPhoto(null);
                          setMessage(
                            "Your experience was added to your timeline.",
                          );
                        })
                      }
                    />
                    <ActionStatus action={action} />
                  </Card>
                  <Title>Your evidence history</Title>
                  <Body>
                    Early → established → long-term. Dates reported by you and
                    history documented on Unmask are shown separately.
                  </Body>
                  {feed.data?.map((e) => (
                    <ExperienceCard key={e.id} item={e} productLink={false} />
                  ))}
                  {feed.data?.length === 0 ? (
                    <Empty
                      title="Your first chapter."
                      body="Add an observation when you have something useful to record. You can return when your experience changes."
                    />
                  ) : null}
                  <Button
                    quiet
                    label="Add to a routine"
                    onPress={() => r.push("/products" as Href)}
                  />
                  <Button
                    quiet
                    label="View product evidence"
                    onPress={() =>
                      r.push(`/watch/${encodeURIComponent(p.id)}` as Href)
                    }
                  />
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}
