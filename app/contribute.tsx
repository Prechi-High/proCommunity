import * as ImagePicker from "expo-image-picker";
import { Field } from "@/components/community-v2/ui";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityPage } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Photo,
  Pill,
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/clarity/api";
import * as community from "@/lib/community-v2/api";
import * as living from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
export default function Contribute() {
  const r = useRouter();
  const qc = useQueryClient();
  const p = useLocalSearchParams<{
    product?: string;
    experience?: string;
    mine?: string;
    update?: string;
  }>();
  const uid = useAppStore((s) => s.profile?.id);
  const [photo, setPhoto] = useState("");
  const [step, setStep] = useState(
    p.experience
      ? p.update
        ? "update"
        : "detail"
      : p.product
        ? "write"
        : p.mine
          ? "mine"
          : "choose",
  );
  const [product, setProduct] = useState(p.product || "");
  const [search, setSearch] = useState("");
  const [duration, setDuration] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [skin, setSkin] = useState("Not disclosed");
  const [goal, setGoal] = useState("");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("Mixed");
  const [status, setStatus] = useState("Still using");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ownWords, setOwnWords] = useState(false);
  const cat = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  const detail = useQuery({
    queryKey: ["clarity-experience", p.experience],
    queryFn: () => community.experience(p.experience!),
    enabled: !!p.experience,
  });
  const own = useQuery({
    queryKey: ["my-clarity-experiences"],
    queryFn: () => api.experiences(true),
    enabled: !!uid && step === "mine",
  });
  const updates = useQuery({
    queryKey: ["experience-followups", p.experience],
    queryFn: () => community.entries(p.experience!, "followups"),
    enabled: !!p.experience,
  });
  const replies = useQuery({
    queryKey: ["experience-replies", p.experience],
    queryFn: () => community.entries(p.experience!, "replies"),
    enabled: !!p.experience,
  });
  const selected = cat.data?.find((x) => x.id === product);
  const e = detail.data;
  const key = `unmask:experience-draft:${uid || "guest"}:${p.experience || product || "new"}`;
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    let active = true;
    setDraftReady(false);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active || !raw) return;
        const d = JSON.parse(raw);
        setDuration(d.duration || "");
        setFrequency(d.frequency || "Once daily");
        setGoal(d.goal || "");
        setBody(d.body || "");
        setSkin(d.skin || "Not disclosed");
        setOutcome(d.outcome || "Mixed");
        setStatus(d.status || "Still using");
        setVisibility(d.visibility === "public" ? "public" : "private");
      })
      .catch(() => {
        if (active) setError("Your draft could not be loaded.");
      })
      .finally(() => {
        if (active) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  const run = async (fn: () => Promise<void>) => {
    if (!uid) {
      r.push("/(auth)/sign-in");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const photoPath = photo ? await community.uploadPhoto(photo) : null;
      if (step === "update-preview") {
        await community.addEntry(
          p.experience!,
          body,
          "followups",
          duration,
          status,
          photoPath || "",
        );
      } else {
        if (!selected) throw new Error("Select a product before publishing.");
        await living.registerProduct({
          id: selected.id,
          name: selected.name,
          brand: selected.brand || "",
          category: selected.category || "",
          heroImageUrl: selected.image_url,
        });
        await api.saveExperience({
          photo_path: photoPath,
          product_id: product,
          duration,
          frequency,
          goal,
          body: body.trim(),
          outcome,
          uncertainty: "",
          context: "",
          skin_type: skin === "Not disclosed" ? null : skin,
          acquisition: "Prefer not to say",
          usage_status: status,
          would_rebuy: "Not stated",
          visibility,
        });
      }
      await AsyncStorage.removeItem(key);
      await qc.invalidateQueries();
      setStep("done");
    });
  const productCard = (name?: string, image?: string | null) => (
    <Card>
      {image ? <Photo uri={image} size={90} /> : null}
      <Heading>{name || "Product experience"}</Heading>
    </Card>
  );
  const compose = (
    <>
      {step === "update" ? (
        <Notice>
          This update stays connected to your original experience and inherits
          its visibility.
        </Notice>
      ) : null}
      <Field
        label={
          step === "update"
            ? "Usage duration / time since stopping"
            : "How long have you used it?"
        }
        value={duration}
        onChange={setDuration}
      />
      {step !== "update" ? (
        <>
          <Chips
            options={["Once daily", "Twice daily", "Occasionally", "Other"]}
            value={frequency}
            onChange={setFrequency}
          />
          <Copy>Skin type (optional)</Copy>
          <Chips
            options={[
              "Not disclosed",
              "Dry",
              "Oily",
              "Combination",
              "Sensitive",
              "Not sure",
            ]}
            value={skin}
            onChange={setSkin}
          />
          <Field
            label="What were you hoping for?"
            value={goal}
            onChange={setGoal}
            multiline
          />
        </>
      ) : null}
      <Field
        label={step === "update" ? "What changed?" : "What happened?"}
        value={body}
        onChange={setBody}
        multiline
      />
      <Chips
        options={["Still using", "Stopped using", "Finished it"]}
        value={status}
        onChange={setStatus}
      />
      {step !== "update" ? (
        <>
          <Chips
            options={["Positive", "Mixed", "Negative"]}
            value={outcome}
            onChange={setOutcome}
          />
          <Copy>Choose who can see this experience</Copy>
          <Chips
            options={["private", "public"]}
            value={visibility}
            onChange={(v) =>
              setVisibility(v === "public" ? "public" : "private")
            }
          />
        </>
      ) : null}
      <Button
        quiet
        label={photo ? "Change attached photo" : "Add a photo (optional)"}
        onPress={() =>
          void run(async () => {
            const out = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.8,
            });
            if (!out.canceled) setPhoto(out.assets[0].uri);
          })
        }
      />
      {photo ? (
        <>
          <Photo uri={photo} size={160} />
          <Button quiet label="Remove photo" onPress={() => setPhoto("")} />
        </>
      ) : null}
      <Button
        label={step === "update" ? "Preview update" : "Review experience"}
        disabled={
          !draftReady ||
          !duration.trim() ||
          body.trim().length < 10 ||
          body.length > 4000
        }
        onPress={() =>
          setStep(step === "update" ? "update-preview" : "preview")
        }
      />
      <Button
        quiet
        label="Save draft"
        disabled={!draftReady || busy}
        onPress={() =>
          void run(async () => {
            await AsyncStorage.setItem(
              key,
              JSON.stringify({
                duration,
                frequency,
                goal,
                body,
                skin,
                outcome,
                status,
                visibility,
              }),
            );
            setError("Draft saved privately on this device.");
          })
        }
      />
    </>
  );
  return (
    <CommunityPage
      title={
        step === "detail"
          ? "Experience"
          : step === "update"
            ? "How has it been since?"
            : step.includes("preview")
              ? "Ready to share?"
              : step === "choose"
                ? "What have you used?"
                : step === "done"
                  ? "Your contribution is saved."
                  : "Your experience matters."
      }
    >
      {error ? <Notice>{error}</Notice> : null}
      {!uid && step !== "detail" ? (
        <Button
          label="Sign in to contribute"
          onPress={() => r.push("/(auth)/sign-in")}
        />
      ) : null}
      {step === "mine" ? (
        <>
          <Busy
            loading={own.isLoading}
            error={own.error}
            retry={() => void own.refetch()}
          />
          {own.data?.map((x) => (
            <Card key={x.id}>
              <Heading>{x.unmask_catalog?.name || "Experience"}</Heading>
              <Copy>{x.body}</Copy>
              <Button
                label="View experience"
                onPress={() => r.push(`/contribute?experience=${x.id}` as Href)}
              />
            </Card>
          ))}
          <Button
            label="Share another experience"
            onPress={() => setStep("choose")}
          />
        </>
      ) : null}
      {step === "choose" ? (
        <>
          <Field label="Find a product" value={search} onChange={setSearch} />
          <Busy
            loading={cat.isLoading}
            error={cat.error}
            retry={() => void cat.refetch()}
          />
          {cat.data
            ?.filter((x) =>
              `${x.name} ${x.brand}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .slice(0, 20)
            .map((x) => (
              <Card key={x.id}>
                <Photo uri={x.image_url} size={80} />
                <Heading>{x.name}</Heading>
                <Button
                  label="Share experience"
                  onPress={() => {
                    setProduct(x.id);
                    setStep("write");
                  }}
                />
              </Card>
            ))}
          <Button
            quiet
            label="Search all products"
            onPress={() => r.push("/unmask" as Href)}
          />
        </>
      ) : null}
      {step === "write" ? (
        <>
          {productCard(selected?.name, selected?.image_url)}
          <Button
            quiet
            label="Change product"
            onPress={() => setStep("choose")}
          />
          {compose}
        </>
      ) : null}
      {step === "detail" || step === "update" ? (
        <>
          <Busy
            loading={detail.isLoading}
            error={detail.error}
            retry={() => void detail.refetch()}
          />
          {e ? (
            <>
              {productCard(e.unmask_catalog?.name, e.unmask_catalog?.image_url)}
              <Pill>
                {e.visibility === "public"
                  ? "Community experience"
                  : "Only you"}
              </Pill>
              <Heading>{e.author_name}</Heading>
              <Copy muted>
                {e.skin_type || "Skin type not shared"} · {e.duration} ·{" "}
                {e.frequency || "Frequency not stated"}
              </Copy>
              <Copy>{e.body}</Copy>
              <ExperiencePhoto path={e.photo_path} />
              {step === "update" && e.user_id === uid ? compose : null}
              {step === "detail" ? (
                <>
                  <Busy
                    loading={updates.isLoading}
                    error={updates.error}
                    retry={() => void updates.refetch()}
                  />
                  {updates.data?.map((u) => (
                    <Card key={u.id}>
                      <Copy small>
                        {u.duration} · {u.usage_status}
                      </Copy>
                      <Copy>{u.body}</Copy>
                      <ExperiencePhoto path={u.photo_path} />
                    </Card>
                  ))}
                  {e.user_id === uid ? (
                    <Button
                      label="Add an experience update"
                      onPress={() => {
                        setBody("");
                        setDuration("");
                        setStep("update");
                      }}
                    />
                  ) : null}
                  <Button
                    quiet
                    label="Ask about this product"
                    onPress={() =>
                      r.push(`/product/${e.product_id}/ask-community` as Href)
                    }
                  />
                  {e.visibility === "public" ? (
                    <Button
                      quiet
                      label="Request an Unmask"
                      onPress={() =>
                        r.push({
                          pathname: "/investigation/request",
                          params: { product: e.product_id, experience: e.id },
                        } as Href)
                      }
                    />
                  ) : null}
                  <Heading>Replies</Heading>
                  <Busy
                    loading={replies.isLoading}
                    error={replies.error}
                    retry={() => void replies.refetch()}
                  />
                  {replies.data?.map((x) => (
                    <Card key={x.id}>
                      <Copy small>{x.author_name}</Copy>
                      <Copy>{x.body}</Copy>
                    </Card>
                  ))}
                  <Field
                    label="Add a reply"
                    value={reply}
                    onChange={setReply}
                    multiline
                  />
                  <Button
                    label="Reply"
                    disabled={busy || !reply.trim() || reply.length > 2000}
                    onPress={() =>
                      void run(async () => {
                        await community.addEntry(e.id, reply, "replies");
                        setReply("");
                        await replies.refetch();
                      })
                    }
                  />
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {step === "preview" || step === "update-preview" ? (
        <>
          <Card>
            <Pill>
              {step === "update-preview" ? e?.visibility : visibility}
            </Pill>
            <Copy>
              {duration} · {status}
            </Copy>
            {goal ? <Copy>{goal}</Copy> : null}
            <Copy>{body}</Copy>
            {step === "preview" ? (
              <Copy>
                {skin} · {outcome}
              </Copy>
            ) : null}
          </Card>
          <Button
            quiet
            label={
              ownWords
                ? "✓ This reflects my own experience"
                : "Confirm: this reflects my own experience"
            }
            onPress={() => setOwnWords(!ownWords)}
          />
          <Button
            label="Save contribution"
            disabled={busy || !ownWords || !uid}
            onPress={() => void save()}
          />
          <Button
            quiet
            label="Edit"
            onPress={() =>
              setStep(step === "update-preview" ? "update" : "write")
            }
          />
        </>
      ) : null}
      {step === "done" ? (
        <>
          <Copy>Your privacy choice has been preserved.</Copy>
          <Button
            label="Back to Community"
            onPress={() => r.push("/pulse" as Href)}
          />
        </>
      ) : null}
    </CommunityPage>
  );
}

function ExperiencePhoto({ path }: { path?: string | null }) {
  const q = useQuery({
    queryKey: ["experience-photo", path],
    queryFn: () => community.photoUrl(path!),
    enabled: !!path,
    staleTime: 120000,
  });
  return path ? (
    <>
      <Busy
        error={q.error}
        loading={q.isLoading}
        retry={() => void q.refetch()}
      />
      {q.data ? <Photo uri={q.data} size={220} /> : null}
    </>
  ) : null;
}
