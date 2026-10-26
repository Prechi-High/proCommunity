import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { getKnownProduct } from "@/lib/products";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import * as tracking from "@/lib/tracking/api";
import { useTrackingDraft } from "@/lib/tracking/draft";
import {
  AppShell,
  ActionButton,
  FilterChips,
  SearchField,
  StatusMessage,
} from "@/components/unmask-ui";
import {
  Input,
  Label,
  Note,
  PhotoField,
  PrivacyChoice,
  ReminderFields,
  durationOptions,
  statusNames,
} from "./Fields";
import { colors, fonts } from "@/constants/theme";
import type { ProductState } from "@/lib/living/types";
export function TrackingWizard({
  productId = "",
  journeyId,
}: {
  productId?: string;
  journeyId?: string;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = useTrackingDraft(
    `unmask:tracking:${uid || "guest"}:${journeyId || productId || "new"}`,
    {
      step: productId ? 1 : 0,
      product: productId,
      status: "active",
      duration: "Week 1",
      frequency: "Once a day",
      skin: "",
      body: "",
      reason: "",
      visibility: "private",
      ownership: "",
      skinPhoto: "",
      logOn: false,
      routineOn: false,
      time: "19:00",
      updateId: tracking.operationId(),
    },
  );
  const d = draft.value;
  const set = (patch: Partial<typeof d>) =>
    draft.setValue((v) => ({ ...v, ...patch }));
  const cat = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  const exact = useQuery({
    queryKey: ["catalog", d.product],
    queryFn: () => living.catalog(d.product),
    enabled: !!d.product,
  });
  const preference = useQuery({
    queryKey: ["tracking-skin", uid],
    queryFn: clarity.preferences,
    enabled: !!uid,
  });
  const current = useQuery({
    queryKey: ["tracking-journey", journeyId],
    queryFn: () =>
      living.journey(journeyId!) as Promise<tracking.TrackedJourney>,
    enabled: !!journeyId && !!uid,
  });
  const ownership = useQuery({
    queryKey: ["ownership-proof", journeyId],
    queryFn: () => tracking.proof(journeyId!),
    enabled: !!journeyId && !!uid,
  });
  const existingReminders = useQuery({
    queryKey: ["tracking-reminders", journeyId],
    queryFn: () => tracking.reminders(journeyId!),
    enabled: !!journeyId && !!uid,
  });
  const loaded = useRef(false);
  useEffect(() => {
    if (
      current.data &&
      draft.ready &&
      !existingReminders.isLoading &&
      !loaded.current
    ) {
      loaded.current = true;
      if (draft.restored) return;
      const j = current.data;
      set({
        step: 1,
        logOn: !!existingReminders.data?.find((x) => x.kind === "log")?.enabled,
        routineOn: !!existingReminders.data?.find((x) => x.kind === "routine")
          ?.enabled,
        time: existingReminders.data?.[0]?.time_label || "19:00",
        product: j.product_id,
        status: j.status,
        duration: d.body ? d.duration : j.usage_duration || d.duration,
        frequency: j.frequency || d.frequency,
        skin: j.skin_type || d.skin,
        visibility: j.visibility === "public" ? "public" : "private",
      });
    }
  }, [
    current.data,
    draft.ready,
    existingReminders.data,
    existingReminders.isLoading,
  ]);
  useEffect(() => {
    if (draft.ready && preference.data?.skin_type && !d.skin)
      set({ skin: preference.data.skin_type });
  }, [preference.data, draft.ready, d.skin]);
  const known = getKnownProduct(d.product);
  const p =
    cat.data?.find((x) => x.id === d.product) ||
    exact.data?.[0] ||
    (known
      ? {
          id: known.id,
          name: known.name,
          brand: known.brand,
          category: known.category,
          image_url: known.heroImageUrl,
        }
      : undefined);
  async function save() {
    if (busy) return;
    if (!uid) {
      r.push({
        pathname: "/(auth)/sign-in",
        params: {
          returnTo: journeyId
            ? `/journey/${journeyId}/update`
            : "/products/add",
        },
      } as Href);
      return;
    }
    if (!p) return;
    setError("");
    if (
      !d.ownership &&
      (!ownership.data || ownership.data.status === "rejected")
    ) {
      setError(
        "Add a product photo for the ownership review. Your draft is saved.",
      );
      return;
    }
    if (d.status !== "purchased" && d.body.trim().length < 10) {
      setError(
        "Add a little more about your experience (at least 10 characters).",
      );
      return;
    }
    try {
      if (d.logOn || d.routineOn) tracking.nextReminder(d.time, "daily");
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    try {
      await living.registerProduct({
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        category: p.category || "Skincare",
        heroImageUrl: p.image_url,
      });
      const j = journeyId
        ? current.data
        : await living.saveJourney({
            product_id: p.id,
            acquisition: "purchased",
            status: d.status as ProductState,
            visibility: d.visibility as "public" | "private",
            frequency: d.frequency,
            usage_duration: d.duration,
            skin_type: d.skin || null,
          } as Partial<tracking.TrackedJourney> & {
            product_id: string;
            acquisition: string;
          });
      if (!j) throw new Error("Your timeline is still loading.");
      if (
        d.ownership &&
        (!ownership.data || ownership.data.status === "rejected")
      ) {
        const existing = await tracking.proof(j.id);
        if (existing?.status === "rejected") {
          const removed = await clarity
            .db()
            .from("unmask_ownership_proofs")
            .delete()
            .eq("id", existing.id);
          if (removed.error) throw removed.error;
        }
        if (!existing || existing.status === "rejected")
          await tracking.submitProof(
            j.id,
            await tracking.uploadProof(d.ownership),
          );
      }
      if (d.skin && preference.isSuccess && !preference.data?.skin_type)
        await clarity.savePreferences({
          skin_type: d.skin,
          skin_public: preference.data?.skin_public ?? false,
          save_investigations: preference.data?.save_investigations ?? false,
        });
      if (d.status !== "purchased") {
        const photo_path = d.skinPhoto
          ? await living.uploadPhoto(d.skinPhoto)
          : null;
        await tracking.logUsage(j.id, d.updateId, {
          body: d.body.trim(),
          duration: d.duration,
          frequency: d.frequency,
          skin_type: d.skin,
          status: d.status,
          reason: d.reason,
          visibility: d.visibility,
          photo_path,
        });
      } else if (journeyId)
        await living.patchJourney(j.id, {
          status: "purchased",
          visibility: d.visibility as "private" | "public",
        });
      await tracking.saveReminders(j.id, [
        { kind: "log", enabled: d.logOn, time: d.time, cadence: "weekly" },
        {
          kind: "routine",
          enabled: d.routineOn,
          time: d.time,
          cadence: "daily",
        },
      ]);
      await draft.clear();
      await qc.invalidateQueries();
      r.replace(`/journey/${j.id}` as Href);
    } catch (e) {
      setError(
        (e as Error).message ||
          "Not all changes saved. Your draft is here; retry without starting over.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!draft.ready)
    return (
      <AppShell back title="Opening your draft…">
        {null}
      </AppShell>
    );
  return (
    <AppShell
      back
      navigation
      title={journeyId ? "How has it been?" : "Your product, your pace."}
      subtitle={
        d.step
          ? `${p?.name || "Product timeline"} · Step ${d.step} of 3`
          : "Choose the product you use. We’ll take it one step at a time."
      }
    >
      {!uid ? (
        <StatusMessage
          title="Your draft stays on this device."
          detail="Sign in to save your timeline securely."
        />
      ) : null}
      {d.step === 0 ? (
        <>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Find your product"
          />
          {cat.isError ? (
            <ActionButton
              label="Retry products"
              onPress={() => void cat.refetch()}
            />
          ) : null}
          {cat.data
            ?.filter((p) =>
              `${p.name} ${p.brand}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .slice(0, 15)
            .map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => set({ product: p.id, step: 1 })}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: "#F5F0EB",
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 16,
                    color: colors.ink,
                  }}
                >
                  {p.name}
                </Text>
              </Pressable>
            ))}
          <ActionButton
            tone="ghost"
            label="Search the community catalogue"
            onPress={() => r.push("/results")}
          />
        </>
      ) : null}
      {d.step === 1 ? (
        <>
          <Label>Where are you with this product?</Label>
          <FilterChips
            variant="chips"
            options={Object.values(statusNames)}
            value={statusNames[d.status] || "Still using"}
            onChange={(v) =>
              set({
                status:
                  Object.keys(statusNames).find((k) => statusNames[k] === v) ||
                  "active",
              })
            }
          />
          {d.status !== "purchased" ? (
            <>
              <Label>How long have you used it?</Label>
              <FilterChips
                variant="chips"
                options={durationOptions}
                value={d.duration}
                onChange={(v) => set({ duration: v })}
              />
              <Input
                label="Or write your own duration"
                value={d.duration}
                onChange={(v) => set({ duration: v })}
              />
              <Label>Your routine</Label>
              <FilterChips
                variant="chips"
                options={[
                  "Once a day",
                  "Twice a day",
                  "A few times a week",
                  "Once a week",
                  "As needed",
                ]}
                value={d.frequency}
                onChange={(v) => set({ frequency: v })}
              />
              {preference.data?.skin_type ? (
                <Note>
                  Skin type from your profile: {preference.data.skin_type}. You
                  can change the context below if needed.
                </Note>
              ) : (
                <Note>
                  Add your skin type to your profile, or leave it unstated.
                </Note>
              )}
              <FilterChips
                variant="chips"
                options={[
                  "Not stated",
                  "Dry",
                  "Oily",
                  "Combination",
                  "Normal",
                  "Sensitive",
                  "Not sure",
                ]}
                value={d.skin || "Not stated"}
                onChange={(v) => set({ skin: v === "Not stated" ? "" : v })}
              />
            </>
          ) : null}
          {["paused", "stopped", "finished"].includes(d.status) ? (
            <Input
              label="Anything you want to note about stopping? (optional)"
              value={d.reason}
              onChange={(v) => set({ reason: v })}
            />
          ) : null}
          <ActionButton
            label="Continue"
            disabled={!p}
            onPress={() => set({ step: 2 })}
          />
        </>
      ) : null}
      {d.step === 2 ? (
        <>
          <Label>
            {journeyId
              ? "A new chapter in your experience."
              : "What have you noticed?"}
          </Label>
          <Note>
            Good, disappointing, unchanged or still unsure — your context is
            useful.
          </Note>
          <Input
            label="Your experience"
            multiline
            value={d.body}
            onChange={(v) => set({ body: v })}
          />
          {d.status === "active" ? (
            <View
              style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: "#EEF3ED",
                gap: 10,
              }}
            >
              <Label>Keep the story going.</Label>
              <Note>
                Save a starting point now. Come back in two weeks or a month to
                see what changed. No pressure to update every day.
              </Note>
            </View>
          ) : null}
          <PhotoField
            label="Add a skin progress photo (optional)"
            value={d.skinPhoto}
            onChange={(v) => set({ skinPhoto: v })}
            camera
          />
          <Note>
            Try the same light and angle each time. Photos help you compare;
            they don’t diagnose a skin condition.
          </Note>
          <ActionButton
            label="Privacy & finish"
            onPress={() => set({ step: 3 })}
          />
        </>
      ) : null}
      {d.step === 3 ? (
        <>
          <PrivacyChoice
            value={d.visibility}
            onChange={(v) => set({ visibility: v })}
          />
          {ownership.data && ownership.data.status !== "rejected" ? (
            <StatusMessage
              title={
                ownership.data.status === "verified"
                  ? "Ownership verified"
                  : "Ownership photo submitted"
              }
              detail="A photo is not a product safety endorsement."
            />
          ) : (
            <>
              <Label>A product photo, to support ownership.</Label>
              <Note>
                Show the product you have. This proof photo is private to you
                and the review team; it is separate from your skin photos. A
                verified ownership badge appears only after review.
              </Note>
              <PhotoField
                label="Add ownership product photo"
                value={d.ownership}
                onChange={(v) => set({ ownership: v })}
                camera
              />
            </>
          )}
          <ReminderFields
            logOn={d.logOn}
            routineOn={d.routineOn}
            time={d.time}
            onChange={set}
          />
          <Note>
            Your draft is saved on this device as you go. You can stop and
            return.
          </Note>
          <ActionButton
            label={
              d.visibility === "public"
                ? "Save public experience"
                : "Save private experience"
            }
            pending={busy}
            onPress={() => void save()}
          />
        </>
      ) : null}
      {error ? (
        <StatusMessage
          kind="error"
          title="Let’s finish saving this."
          detail={error}
        />
      ) : null}
      {d.step > 0 ? (
        <ActionButton
          tone="ghost"
          label={d.step === 1 ? "Change product" : "Previous step"}
          onPress={() => set({ step: d.step - 1 })}
        />
      ) : null}
    </AppShell>
  );
}
