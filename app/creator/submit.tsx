import { useEffect, useRef, useState } from "react";
import { Linking, Switch, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import { CreatorGate } from "@/components/creator/Gate";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/creator/api";
function key() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}
export default function Submit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <CreatorGate>
      <Form key={id} id={id} />
    </CreatorGate>
  );
}
function Form({ id }: { id: string }) {
  const uid = useAppStore((s) => s.profile!.id);
  const r = useRouter();
  const qc = useQueryClient();
  const a = useQuery({
    queryKey: ["creator-assignment", id, uid],
    queryFn: () => api.assignment(id),
  });
  const d = useQuery({
    queryKey: ["creator-draft", id, uid],
    queryFn: () => api.draft(id),
  });
  const reviews = useQuery({
    queryKey: ["creator-reviews", uid],
    queryFn: api.reviews,
  });
  const [form, setForm] = useState<api.Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const loaded = useRef(false);
  const attempt = useRef(key());
  const lock = useRef(false);
  useEffect(() => {
    if (a.data && d.isSuccess && !loaded.current) {
      const base = api.emptyDraft(id, uid, a.data.title);
      setForm({ ...base, ...d.data, title: d.data?.title || base.title });
      loaded.current = true;
    }
  }, [a.data, d.data, d.isSuccess, id, uid]);
  const latest = reviews.data?.find((s) => s.investigation_id === id);
  const patch = (p: Partial<api.Draft>) => {
    if (busy) return;
    setForm((f) => (f ? { ...f, ...p } : f));
    setDirty(true);
    setNotice("");
  };
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["creator-draft", id, uid] }),
      qc.invalidateQueries({ queryKey: ["creator-drafts", uid] }),
      qc.invalidateQueries({ queryKey: ["creator-reviews", uid] }),
    ]);
  };
  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not complete this action. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const choose = () =>
    run(async () => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Allow media access to choose a video.");
      const out = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
      });
      if (!out.canceled) {
        const asset = out.assets[0];
        if (asset.fileSize && asset.fileSize > 52428800)
          throw new Error("Upload a video smaller than 50 MB.");
        const path = await api.uploadVideo(
          id,
          asset.uri,
          asset.mimeType,
          asset.fileSize,
        );
        setForm((f) => (f ? { ...f, video_path: path } : f));
        setDirty(true);
        setNotice("Video uploaded privately. Save your draft to attach it.");
      }
    });
  const valid =
    !!form &&
    form.accepted &&
    form.title.trim().length >= 3 &&
    form.title.length <= 100 &&
    form.summary.trim().length >= 10 &&
    form.summary.length <= 300 &&
    form.narrative.length <= 6000 &&
    form.sources.trim().length >= 5 &&
    form.sources.length <= 6000 &&
    form.response.length <= 500 &&
    form.permissions_checked &&
    form.commercial_checked &&
    !!form.video_path;
  const underReview =
    latest?.status === "in_review" || latest?.status === "approved";
  return (
    <UtilityPage
      title="Bring the findings together."
      sub="PRIVATE CREATOR WORKSPACE · Submit / revise video"
    >
      <Busy
        loading={a.isLoading || d.isLoading || reviews.isLoading}
        error={a.error || d.error || reviews.error}
        retry={() => {
          void a.refetch();
          void d.refetch();
          void reviews.refetch();
        }}
      />
      {a.data ? <Heading>{a.data.title}</Heading> : null}
      {form ? (
        <>
          <Pill>
            {a.data?.status === "published"
              ? "Published"
              : latest?.status.replaceAll("_", " ") || "Draft"}
          </Pill>
          {latest?.feedback ? (
            <Card>
              <Heading>Editorial feedback</Heading>
              <Copy>{latest.feedback}</Copy>
              <Copy small>
                {new Date(latest.created_at).toLocaleDateString("en-NG", {
                  timeZone: "Africa/Lagos",
                })}
              </Copy>
            </Card>
          ) : null}
          {underReview ? (
            <Notice>
              Your submitted version is with Editorial. Draft changes do not
              replace that submitted version. You can submit again after changes
              are requested.
            </Notice>
          ) : null}
          <Card>
            <Heading>Video</Heading>
            <Copy>
              {form.video_path
                ? form.video_path.split("/").at(-1)
                : "No video uploaded yet."}
            </Copy>
            <Copy small>
              Private MP4, MOV or WebM · up to 50 MB. Compress larger files
              before uploading.
            </Copy>
            <Button
              quiet
              disabled={busy || a.data?.status === "published"}
              label={form.video_path ? "Replace video" : "Upload video"}
              onPress={() => void choose()}
            />
            {form.video_path ? (
              <Button
                quiet
                disabled={busy}
                label="Preview uploaded video"
                onPress={() =>
                  void run(async () => {
                    const { signedUrl } = await api.videoUrl(form.video_path!);
                    await Linking.openURL(signedUrl);
                  })
                }
              />
            ) : null}
          </Card>
          <Field
            label="Video title"
            value={form.title}
            onChange={(title) => patch({ title })}
          />
          <Copy small>{form.title.length}/100</Copy>
          <Field
            label="Summary"
            multiline
            value={form.summary}
            onChange={(summary) => patch({ summary })}
          />
          <Copy small>{form.summary.length}/300</Copy>
          <Field
            label="Private narrative notes"
            multiline
            value={form.narrative}
            onChange={(narrative) => patch({ narrative })}
          />
          <Copy small>{form.narrative.length}/6000</Copy>
          <Field
            label="Sources and attribution"
            multiline
            value={form.sources}
            onChange={(sources) => patch({ sources })}
          />
          <Copy small>
            {form.sources.length}/6000 · Cite sources and label community
            accounts, company statements and expert explanations.
          </Copy>
          <Button
            quiet
            label="View approved research materials"
            onPress={() => r.push(`/creator/assignment?id=${id}` as Href)}
          />
          <Copy>Disclosure</Copy>
          <Chips
            options={[
              "Community-supported",
              "Sponsored",
              "Gifted product",
              "No commercial relationship",
            ]}
            value={form.disclosure}
            onChange={(disclosure) => patch({ disclosure })}
          />
          <Field
            label="Creator response to feedback (optional)"
            multiline
            value={form.response}
            onChange={(response) => patch({ response })}
          />
          <Copy small>{form.response.length}/500</Copy>
          {[
            ["Availability confirmed", form.accepted, "accepted"],
            [
              "Sources and permissions checked",
              form.permissions_checked,
              "permissions_checked",
            ],
            [
              "Commercial relationships disclosed",
              form.commercial_checked,
              "commercial_checked",
            ],
          ].map(([label, value, field]) => (
            <View
              key={String(field)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <View style={{ flex: 1 }}>
                <Copy>{String(label)}</Copy>
              </View>
              <Switch
                disabled={busy}
                accessibilityLabel={String(label)}
                value={value as boolean}
                onValueChange={(v) => patch({ [String(field)]: v })}
              />
            </View>
          ))}
          <Button
            disabled={
              busy ||
              !valid ||
              underReview ||
              !!submitted ||
              a.data?.status === "published" ||
              reviews.isError
            }
            label={
              busy
                ? "Please wait…"
                : latest
                  ? "Submit revision"
                  : "Submit for editorial review"
            }
            onPress={() =>
              void run(async () => {
                await api.saveDraft(id, form);
                const receipt = await api.submit(id, attempt.current);
                setSubmitted(receipt);
                setDirty(false);
                await refresh();
                setNotice(
                  "Submitted for editorial review. This does not publish your video or create earnings.",
                );
              })
            }
          />
          <Button
            quiet
            disabled={
              busy ||
              form.title.length > 100 ||
              form.summary.length > 300 ||
              form.sources.length > 6000 ||
              form.narrative.length > 6000 ||
              form.response.length > 500
            }
            label="Save draft"
            onPress={() =>
              void run(async () => {
                await api.saveDraft(id, form);
                setDirty(false);
                await refresh();
                setNotice("Draft saved privately.");
              })
            }
          />
          {submitted ? (
            <Copy small>Submission reference: {submitted}</Copy>
          ) : null}
          <Button
            quiet
            disabled={busy}
            label="Back to workspace"
            onPress={() => (dirty ? setConfirm(true) : r.replace("/creator"))}
          />
          {confirm ? (
            <Card>
              <Copy>Leave without saving your latest edits?</Copy>
              <Button
                label="Leave without saving"
                onPress={() => r.replace("/creator")}
              />
              <Button
                quiet
                label="Keep editing"
                onPress={() => setConfirm(false)}
              />
            </Card>
          ) : null}
        </>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice>{notice}</Notice> : null}
    </UtilityPage>
  );
}
