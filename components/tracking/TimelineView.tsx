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
  const r = useRouter(),
    qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const q = useQuery({
    queryKey: ["tracking-journey", id],
    queryFn: () => living.journey(id) as Promise<tracking.TrackedJourney>,
  });
  const history = useQuery({
    queryKey: ["tracking-updates", id, uid],
    queryFn: () => tracking.updates(id),
  });
  const own = !!uid && uid === q.data?.user_id;
  const reminders = useQuery({
    queryKey: ["tracking-reminders", id],
    queryFn: () => tracking.reminders(id),
    enabled: own,
  });
  const proof = useQuery({
    queryKey: ["ownership-proof", id],
    queryFn: () => tracking.proof(id),
    enabled: own,
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
  const j = q.data;
  const photos = (history.data ?? []).filter((x) => x.photo_path);
  const first = photos[0],
    last = photos.length > 1 ? photos[photos.length - 1] : null;
  return (
    <AppShell
      back
      navigation
      title={j?.unmask_catalog?.name || "Your product timeline"}
      subtitle={
        own
          ? "A record you can return to. No catching up required."
          : "An experience over time, shared by an Unmasker."
      }
    >
      {q.isLoading ? <ContentSkeleton /> : null}
      {q.isError ? (
        <StatusMessage
          kind="error"
          title="This timeline is private or unavailable."
        />
      ) : null}
      {j ? (
        <>
          <View
            style={{
              padding: 20,
              gap: 12,
              borderRadius: 22,
              backgroundColor: "#F5EEE6",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 19,
                color: colors.ink,
              }}
            >
              {statusNames[j.status] || j.status} ·{" "}
              {j.usage_duration || "Duration not stated"}
            </Text>
            <Note>
              {j.frequency || "Routine not stated"}
              {j.skin_type ? ` · ${j.skin_type} skin` : ""}
            </Note>
            <Note>
              {j.visibility === "private"
                ? "Private · only you can open this timeline."
                : "Public · others can see its public updates and shared photos."}
            </Note>
            {j.ownership_verified ? (
              <StatusMessage
                kind="success"
                title="Ownership verified"
                detail="Product ownership was reviewed. This does not verify the opinion or product safety."
              />
            ) : own && proof.data ? (
              <Note>
                Ownership photo:{" "}
                {proof.data.status === "pending"
                  ? "submitted for review"
                  : proof.data.status}
                . Proof is separate from skin photos.
              </Note>
            ) : null}
          </View>
          {own ? (
            <>
              <ActionButton
                label="Add an update"
                onPress={() => r.push(`/journey/${id}/update` as Href)}
              />
              <ActionButton
                tone="secondary"
                label="Status, privacy & reminders"
                onPress={edit}
              />
              <ActionButton
                tone="ghost"
                label="Attach this timeline to a post"
                onPress={() => {
                  if (j.visibility !== "public") {
                    setMessage(
                      "Make the timeline public in settings before attaching it to a public post. Private photos stay private unless you publish those updates.",
                    );
                    return;
                  }
                  r.push(
                    `/contribute?product=${j.product_id}&journey=${id}` as Href,
                  );
                }}
              />
            </>
          ) : null}
          {message ? <StatusMessage title={message} /> : null}
          {error ? <StatusMessage kind="error" title={error} /> : null}
          {settings ? (
            <View
              style={{
                gap: 18,
                padding: 18,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Label>Your choice, any time.</Label>
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
                Changing timeline privacy does not publish your older private
                updates. Only updates you mark public can appear to others.
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
                label="Save settings"
                pending={busy}
                onPress={() => void save()}
              />
              <ActionButton
                tone="ghost"
                label="Cancel"
                onPress={() => setSettings(false)}
              />
            </View>
          ) : null}
          {own && reminders.data?.some((x) => x.enabled) ? (
            <>
              <ActionButton
                tone="secondary"
                label="Export calendar reminders"
                onPress={() => {
                  try {
                    exportReminders(
                      j.unmask_catalog?.name || "Product",
                      reminders.data!,
                    );
                    setMessage(
                      "Open the downloaded .ics file in your calendar to enable device alerts. Calendar events must be paused separately when you pause a product.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
              <Note>
                In-app reminders arrive in Notifications. Import the calendar
                file for alerts outside Unmask.
              </Note>
            </>
          ) : null}
          {first ? (
            <>
              <Label>Compare your photos</Label>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TimelinePhoto
                  path={first.photo_path!}
                  label={first.usage_duration || "Starting photo"}
                />
                {last ? (
                  <TimelinePhoto
                    path={last.photo_path!}
                    label={last.usage_duration || "Latest photo"}
                  />
                ) : null}
              </View>
              <Note>
                Different lighting can change how skin looks. This is a visual
                record, not a medical assessment.
              </Note>
            </>
          ) : null}
          <Label>Your experience, chapter by chapter</Label>
          {history.isError ? (
            <ActionButton
              label="Retry timeline updates"
              onPress={() => void history.refetch()}
            />
          ) : null}
          {history.isLoading ? <ContentSkeleton /> : null}
          {(history.data ?? []).map((u, i) => (
            <View
              key={u.id}
              style={{
                borderLeftWidth: 2,
                borderLeftColor: colors.brand,
                paddingLeft: 18,
                paddingVertical: 8,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 16,
                  color: colors.ink,
                }}
              >
                {u.usage_duration || `Update ${i + 1}`}
              </Text>
              <Note>
                {new Date(u.created_at).toLocaleDateString()} ·{" "}
                {u.frequency_snapshot || "Routine not stated"} ·{" "}
                {statusNames[u.status_snapshot || ""] ||
                  u.status_snapshot ||
                  "Status not stated"}{" "}
                · {u.visibility}
              </Note>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  lineHeight: 25,
                  color: colors.ink,
                }}
              >
                {u.changed}
              </Text>
              {u.skin_type ? <Note>Skin type: {u.skin_type}</Note> : null}
              {u.photo_path ? (
                <TimelinePhoto path={u.photo_path} label="Progress photo" />
              ) : null}
            </View>
          ))}
          {history.isSuccess && !history.data.length ? (
            <Note>
              No updates yet. Add your first observation when you’re ready.
            </Note>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
