import { useLocalSearchParams } from "expo-router";
import { demoJournal } from "@/lib/tracking/demo";
import { JournalCard, JournalProduct, journal } from "./JournalUI";
import { Clock, Camera, Lock, ShieldCheck, Check } from "@/components/icons";
import { ContentSkeleton, Skeleton } from "@/components/unmask-ui/Skeleton";
import { MediaFrame } from "@/components/unmask-ui/MediaFrame";
import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useAppStore } from "@/lib/store";
import * as living from "@/lib/living/api";
import * as tracking from "@/lib/tracking/api";
import { exportReminders } from "@/lib/tracking/calendar";
import {
  AppShell,
  ActionButton,
  StatusMessage,
  FilterChips,
} from "@/components/unmask-ui";
import {
  Input,
  Label,
  Note,
  PrivacyChoice,
  ReminderFields,
  statusNames,
} from "./Fields";
import { colors, fonts } from "@/constants/theme";
function TimelinePhoto({ path, label }: { path: string; label: string }) {
  const q = useQuery({
    queryKey: ["tracking-photo", path],
    queryFn: () => living.photoUrl(path),
    staleTime: 90000,
  });
  return (
    <View style={{ flex: 1, gap: 6 }}>
      {q.data ? (
        <MediaFrame uri={q.data} label={label} ratio={1.3} corners={false} />
      ) : q.isError ? (
        <Note>This photo is private or unavailable.</Note>
      ) : (
        <Skeleton height={210} radius={18} />
      )}
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 12,
          color: colors.inkSoft,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export function TimelineView({ id }: { id: string }) {
  const demo = demoJournal(id);
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const [tab, setTab] = useState("Timeline");

  const r = useRouter(),
    qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const q = useQuery({
    queryKey: ["tracking-journey", id, uid],
    queryFn: () => living.journey(id) as Promise<tracking.TrackedJourney>,
    enabled: !demo,
  });
  const history = useQuery({
    queryKey: ["tracking-updates", id, uid],
    queryFn: () => tracking.updates(id),
    enabled: !demo,
  });
  const j = demo?.journey || q.data;
  const entries = demo?.updates || history.data || [];
  const own = !!uid && uid === j?.user_id;
  const reminders = useQuery({
    queryKey: ["tracking-reminders", id],
    queryFn: () => tracking.reminders(id),
    enabled: own,
  });
  const proof = useQuery({
    queryKey: ["ownership-proof", id, uid],
    queryFn: () => tracking.proof(id),
    enabled: own,
  });
  const proofImage = useQuery({
    queryKey: ["journal-proof-image", id, uid, proof.data?.photo_path],
    enabled: own && !!proof.data?.photo_path,
    queryFn: async () => {
      const { data, error } = await (
        await import("@/lib/clarity/api")
      )
        .db()
        .storage.from("ownership-proofs")
        .createSignedUrl(proof.data!.photo_path, 180);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const [settings, setSettings] = useState(false),
    [status, setStatus] = useState("active"),
    [privacy, setPrivacy] = useState("private"),
    [reason, setReason] = useState(""),
    [logOn, setLogOn] = useState(false),
    [routineOn, setRoutineOn] = useState(false),
    [time, setTime] = useState("19:00"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  function edit() {
    if (!q.data) return;
    setStatus(q.data.status);
    setPrivacy(q.data.visibility === "public" ? "public" : "private");
    setReason(q.data.stop_reason || "");
    setLogOn(!!reminders.data?.find((x) => x.kind === "log")?.enabled);
    setRoutineOn(!!reminders.data?.find((x) => x.kind === "routine")?.enabled);
    setTime(reminders.data?.[0]?.time_label || "19:00");
    setSettings(true);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (logOn || routineOn) tracking.nextReminder(time, "daily");
      await living.patchJourney(id, {
        status: status as any,
        visibility: privacy as any,
        stop_reason: reason || null,
      });
      await tracking.saveReminders(id, [
        { kind: "log", enabled: logOn, time, cadence: "weekly" },
        { kind: "routine", enabled: routineOn, time, cadence: "daily" },
      ]);
      await qc.invalidateQueries();
      setSettings(false);
      setMessage("Saved. Continue at your own pace.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const photos = entries.filter((x) => x.photo_path);
  const first = photos[0],
    last = photos.length > 1 ? photos[photos.length - 1] : null;
  return (
    <AppShell
      back
      navigation
      title={own || demo ? "My product journal" : "Product journal"}
      subtitle="Your product. Your routine. Your experience over time."
    >
      {q.isLoading && !demo ? <ContentSkeleton /> : null}
      {q.isError && !demo ? (
        <StatusMessage
          kind="error"
          title="This journal is private or unavailable."
        />
      ) : null}
      {j ? (
        <>
          {demo ? (
            <StatusMessage
              title="Demo product journal"
              detail="Fictional notes show how tracking looks. This is a journal preview, with no social comments or real product claims."
            />
          ) : saved && own ? (
            <StatusMessage
              kind="success"
              title="Your chapter is saved."
              detail="You can return whenever you have something new to add."
            />
          ) : null}
          <JournalProduct
            name={j.unmask_catalog?.name || "Your product"}
            brand={j.unmask_catalog?.brand}
            image={j.unmask_catalog?.image_url || proofImage.data}
          />
          <View
            style={{
              padding: 24,
              borderRadius: 27,
              backgroundColor: journal.mint,
              gap: 16,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Clock size={19} color={journal.green} />
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 12,
                  color: journal.green,
                }}
              >
                {statusNames[j.status] || j.status} ·{" "}
                {j.usage_duration || "A new beginning"}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 29,
                lineHeight: 35,
                color: journal.ink,
              }}
            >
              The little changes are worth keeping.
            </Text>
            <Note>
              {j.frequency || "Add your routine"}
              {j.skin_type ? ` · ${j.skin_type} skin` : ""}
            </Note>
            <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 12,
                  color: journal.green,
                }}
              >
                {entries.length} saved{" "}
                {entries.length === 1 ? "chapter" : "chapters"}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 12,
                  color: journal.green,
                }}
              >
                {j.visibility === "public"
                  ? "Shared journal"
                  : "Private journal"}
              </Text>
            </View>
            {own ? (
              <ActionButton
                label="Add my next update"
                onPress={() => r.push(`/journey/${id}/update` as Href)}
              />
            ) : demo ? (
              <ActionButton
                label="Start a journal for my product"
                onPress={() => r.push("/products/add")}
              />
            ) : null}
          </View>
          {j.ownership_verified ? (
            <StatusMessage
              kind="success"
              title="Product ownership verified"
              detail="The product photo was reviewed. The marker can accompany this timeline when attached to an answer; it does not verify product safety or the opinion."
            />
          ) : own && proof.data ? (
            <Note>
              Ownership proof:{" "}
              {proof.data.status === "pending"
                ? "awaiting review"
                : proof.data.status}
              .
            </Note>
          ) : null}
          <FilterChips
            options={["Timeline", "Photos", "Routine"]}
            value={tab}
            onChange={setTab}
          />
          {message ? <StatusMessage title={message} /> : null}
          {error ? <StatusMessage kind="error" title={error} /> : null}
          {tab === "Timeline" ? (
            <>
              <Label>Your chapters</Label>
              <Note>
                This is your product record. No likes, comments or social
                feed—just the context you choose to keep.
              </Note>
              {history.isLoading && !demo ? <ContentSkeleton /> : null}
              {history.isError && !demo ? (
                <ActionButton
                  label="Retry my journal"
                  onPress={() => void history.refetch()}
                />
              ) : null}
              {entries.map((u, i) => (
                <View key={u.id} style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 27, alignItems: "center", gap: 5 }}>
                    <View
                      style={{
                        width: 27,
                        height: 27,
                        borderRadius: 14,
                        backgroundColor: journal.green,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.semibold,
                          fontSize: 12,
                          color: "#fff",
                        }}
                      >
                        {i + 1}
                      </Text>
                    </View>
                    <View
                      style={{ width: 1, flex: 1, backgroundColor: "#C8D9CC" }}
                    />
                  </View>
                  <View style={{ flex: 1, paddingBottom: 16 }}>
                    <JournalCard
                      title={u.usage_duration || `Update ${i + 1}`}
                      detail={`${new Date(u.created_at).toLocaleDateString()} · ${statusNames[u.status_snapshot || ""] || u.status_snapshot || "Observation"}`}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.regular,
                          fontSize: 16,
                          lineHeight: 26,
                          color: journal.ink,
                        }}
                      >
                        {u.changed}
                      </Text>
                      <Note>
                        {u.frequency_snapshot || "Routine not stated"}
                        {u.skin_type ? ` · ${u.skin_type} skin` : ""} ·{" "}
                        {u.visibility}
                      </Note>
                      {u.photo_path ? (
                        <TimelinePhoto
                          path={u.photo_path}
                          label="Photo saved with this chapter"
                        />
                      ) : null}
                    </JournalCard>
                  </View>
                </View>
              ))}
              {!entries.length && !history.isLoading ? (
                <JournalCard title="Every story starts somewhere.">
                  <Note>
                    Add your first note or photo. No catching up required.
                  </Note>
                </JournalCard>
              ) : null}
              {own ? (
                <ActionButton
                  tone="secondary"
                  label="Share my journal with a conversation"
                  onPress={() => {
                    if (j.visibility !== "public") {
                      setMessage(
                        "Your journal is private. Choose to make it public in Routine settings before attaching it to a public answer. Older private photos stay private.",
                      );
                      return;
                    }
                    r.push(
                      `/contribute?product=${j.product_id}&journey=${id}` as Href,
                    );
                  }}
                />
              ) : null}
            </>
          ) : null}
          {tab === "Photos" ? (
            <JournalCard
              title="A starting point. A changing story."
              detail="See your skin photos alongside the dates and usage notes. Similar light and angles make comparisons easier."
            >
              {first ? (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TimelinePhoto
                    path={first.photo_path!}
                    label={first.usage_duration || "Starting point"}
                  />
                  {last ? (
                    <TimelinePhoto
                      path={last.photo_path!}
                      label={last.usage_duration || "Latest update"}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        padding: 20,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: journal.border,
                        borderRadius: 20,
                        gap: 10,
                        justifyContent: "center",
                      }}
                    >
                      <Camera size={27} color={journal.green} />
                      <Note>Your next photo belongs here.</Note>
                    </View>
                  )}
                </View>
              ) : (
                <View
                  style={{
                    padding: 26,
                    borderRadius: 20,
                    backgroundColor: journal.mint,
                    gap: 13,
                    alignItems: "center",
                  }}
                >
                  <Camera size={38} color={journal.green} />
                  <Label>Keep a photo for future you.</Label>
                  <Note>
                    Take a picture of yourself or the skin area you’re
                    following. Add another with a later update to see what
                    changed while using this product.
                  </Note>
                </View>
              )}
              <Note>
                Only photos you choose to share are public. This comparison is a
                visual record, not an automatic improvement score or diagnosis.
              </Note>
              {own ? (
                <ActionButton
                  label="Add a photo with my next update"
                  onPress={() => r.push(`/journey/${id}/update` as Href)}
                />
              ) : null}
            </JournalCard>
          ) : null}
          {tab === "Routine" ? (
            <>
              <JournalCard title="A routine that fits your life.">
                <Label>{j.frequency || "Routine not set yet"}</Label>
                <Note>
                  {j.skin_type ? `Skin context: ${j.skin_type}. ` : ""}
                  {j.stop_reason ? `Your note: ${j.stop_reason}. ` : ""}Pause,
                  finish or return whenever it makes sense. There is no streak
                  to lose.
                </Note>
                <Note>
                  {j.visibility === "public"
                    ? "Others can see this journal and its public chapters."
                    : "Your journal and private photos are only accessible to you."}
                </Note>
                {own ? (
                  <ActionButton
                    tone="secondary"
                    label="Edit status, privacy & reminders"
                    onPress={edit}
                  />
                ) : null}
              </JournalCard>
              {settings ? (
                <JournalCard title="Make it work for you.">
                  <FilterChips
                    variant="chips"
                    options={Object.values(statusNames)}
                    value={statusNames[status]}
                    onChange={(v) =>
                      setStatus(
                        Object.keys(statusNames).find(
                          (k) => statusNames[k] === v,
                        ) || "active",
                      )
                    }
                  />
                  {["paused", "finished", "stopped"].includes(status) ? (
                    <Input
                      label="Why? (optional)"
                      value={reason}
                      onChange={setReason}
                    />
                  ) : null}
                  <PrivacyChoice value={privacy} onChange={setPrivacy} />
                  <Note>
                    Changing journal privacy does not publish older private
                    chapters or photos.
                  </Note>
                  <ReminderFields
                    logOn={logOn}
                    routineOn={routineOn}
                    time={time}
                    onChange={(v) => {
                      if (v.logOn !== undefined) setLogOn(v.logOn);
                      if (v.routineOn !== undefined) setRoutineOn(v.routineOn);
                      if (v.time !== undefined) setTime(v.time);
                    }}
                  />
                  <ActionButton
                    label="Save my choices"
                    pending={busy}
                    onPress={() => void save()}
                  />
                  <ActionButton
                    tone="ghost"
                    label="Cancel"
                    onPress={() => setSettings(false)}
                  />
                </JournalCard>
              ) : null}
              {own && reminders.data?.some((x) => x.enabled) ? (
                <ActionButton
                  tone="ghost"
                  label="Export my calendar reminders"
                  onPress={() => {
                    try {
                      exportReminders(
                        j.unmask_catalog?.name || "Product",
                        reminders.data!,
                      );
                      setMessage(
                        "Import the downloaded calendar file for device alerts. Calendar reminders must be paused separately.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
