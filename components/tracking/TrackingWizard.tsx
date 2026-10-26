import { exactCommunityMatch } from "@/lib/unmask/productIdentityMatch";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useScan } from "@/lib/useScan";
import { searchCommunityProducts } from "@/lib/unmask/communitySearch";
import { Camera, Check } from "@/components/icons";
import { MediaFrame } from "@/components/unmask-ui";
import {
  JournalCard,
  JournalProduct,
  JournalProgress,
  DurationPicker,
  ComparisonPhotoCard,
  OwnershipPhotoCard,
  ChoiceCards,
  journal,
} from "./JournalUI";
import { SkinTypeField } from "./SkinTypeField";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  ContentSkeleton,
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
  resumeGuest,
}: {
  productId?: string;
  journeyId?: string;
  resumeGuest?: string;
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
      productName: "",
      productBrand: "",
      productImage: "",
      productCategory: "",
      status: "active",
      duration: "",
      frequency: "",
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
    uid && resumeGuest ? `unmask:tracking:guest:${resumeGuest}` : undefined,
  );
  const d = draft.value;
  const set = (patch: Partial<typeof d>) =>
    draft.setValue((v) => ({ ...v, ...patch }));
  const reduce = useReducedMotion();
  const scan = useScan({
    onSelect: async (product, photo) => {
      try {
        product =
          exactCommunityMatch(
            product,
            await searchCommunityProducts(product.name),
          ) || product;
      } catch {}
      set({
        product: product.id,
        productName: product.name,
        productBrand: product.brand,
        productCategory: product.category,
        productImage: product.heroImageUrl || photo,
        step: 1,
      });
    },
  });
  const matches = useQuery({
    queryKey: ["journal-product-search", search],
    enabled: search.trim().length > 1,
    queryFn: () => searchCommunityProducts(search),
  });
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
    queryKey: ["tracking-journey", journeyId, uid],
    queryFn: () =>
      living.journey(journeyId!) as Promise<tracking.TrackedJourney>,
    enabled: !!journeyId && !!uid,
  });
  const ownership = useQuery({
    queryKey: ["ownership-proof", journeyId, uid],
    queryFn: () => tracking.proof(journeyId!),
    enabled: !!journeyId && !!uid,
  });
  const existingReminders = useQuery({
    queryKey: ["tracking-reminders", journeyId],
    queryFn: () => tracking.reminders(journeyId!),
    enabled: !!journeyId && !!uid,
  });
  const loaded = useRef(false);
  const profileApplied = useRef(false);
  useEffect(() => {
    loaded.current = false;
    profileApplied.current = false;
  }, [uid, journeyId, productId]);
  useEffect(() => {
    if (
      current.data &&
      draft.ready &&
      !existingReminders.isLoading &&
      !loaded.current
    ) {
      loaded.current = true;
      if (draft.restored && d.product) return;
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
    if (draft.ready && preference.data && !profileApplied.current) {
      profileApplied.current = true;
      if (!draft.restored && !d.skin && preference.data.skin_type)
        set({ skin: preference.data.skin_type });
    }
  }, [preference.data, draft.ready, draft.restored]);
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
      : d.productName
        ? {
            id: d.product,
            name: d.productName,
            brand: d.productBrand,
            category: d.productCategory,
            image_url: /^https?:/.test(d.productImage) ? d.productImage : null,
          }
        : undefined);
  async function save() {
    if (busy) return;
    if (!uid) {
      await AsyncStorage.setItem(
        `unmask:tracking:guest:${journeyId || productId || "new"}`,
        JSON.stringify(d),
      );
      r.push({
        pathname: "/(auth)/sign-in",
        params: {
          returnTo: journeyId
            ? `/journey/${journeyId}/update`
            : `/products/add?product=${encodeURIComponent(productId)}&resumeGuest=${encodeURIComponent(productId || "new")}`,
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
        heroImageUrl:
          p.image_url && /^https?:/.test(p.image_url) ? p.image_url : null,
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
      r.replace(`/journey/${j.id}?saved=1` as Href);
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
      <AppShell back title="Opening your journal…">
        <ContentSkeleton />
      </AppShell>
    );
  const beauty =
    /skin|beauty|cosmetic|body|hair|face|cream|serum|cleanser/i.test(
      `${p?.category || ""} ${p?.name || ""}`,
    );
  const results =
    search.trim().length > 1
      ? (matches.data ?? []).map((x) => ({
          id: x.id,
          name: x.name,
          brand: x.brand,
          category: x.category,
          image_url: x.heroImageUrl,
        }))
      : (cat.data ?? []);
  function next() {
    if (
      d.step === 1 &&
      d.status !== "purchased" &&
      (!d.duration.trim() || !d.frequency || d.frequency === "As needed")
    ) {
      setError("Choose your usage duration and routine before continuing.");
      return;
    }
    if (d.step === 2 && d.status !== "purchased" && d.body.trim().length < 10) {
      setError("A short note of at least 10 characters is enough.");
      return;
    }
    setError("");
    set({ step: Math.min(d.step + 1, 3) });
  }
  return (
    <AppShell
      back
      navigation
      scrollResetKey={d.step}
      title={journeyId ? "Add a new chapter." : "Make it your product story."}
      subtitle="One small step at a time. Your draft saves as you go."
    >
      <JournalProgress step={d.step} />
      {d.step > 0 ? (
        p ? (
          <JournalProduct
            name={p.name}
            brand={p.brand}
            image={d.productImage || p.image_url}
          />
        ) : (
          <ContentSkeleton rows={1} />
        )
      ) : null}
      {!uid ? (
        <Note>
          Your draft stays on this device. Sign in when you’re ready to save
          your journal.
        </Note>
      ) : null}
      {scan.sheet}
      <Animated.View
        key={d.step}
        entering={reduce ? undefined : FadeIn.duration(220)}
        style={{ gap: 18 }}
      >
        {d.step === 0 ? (
          <>
            <JournalCard
              title="Which product is part of your story?"
              detail="Search by name, or let a photo do the finding."
            >
              <View
                style={{
                  padding: 19,
                  borderRadius: 20,
                  backgroundColor: journal.mint,
                  gap: 12,
                }}
              >
                <Camera size={27} color={journal.green} />
                <Label>Have the product with you?</Label>
                <Note>
                  Take or upload a product photo. We’ll suggest a match so you
                  can confirm its name and size before continuing.
                </Note>
                <ActionButton
                  label="Identify my product with a photo"
                  onPress={scan.openCamera}
                />
              </View>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Search product name or brand"
              />
              {(
                search.trim().length > 1 ? matches.isLoading : cat.isLoading
              ) ? (
                <ContentSkeleton />
              ) : null}
              {(search.trim().length > 1 ? matches.isError : cat.isError) ? (
                <ActionButton
                  label="Retry products"
                  onPress={() =>
                    void (search.trim().length > 1
                      ? matches.refetch()
                      : cat.refetch())
                  }
                />
              ) : null}
              {results.slice(0, 12).map((x) => (
                <Pressable
                  key={x.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${x.name}`}
                  onPress={() =>
                    set({
                      product: x.id,
                      productName: x.name,
                      productBrand: x.brand || "",
                      productCategory: x.category || "",
                      productImage: x.image_url || "",
                      step: 1,
                    })
                  }
                  style={({ pressed }) => ({
                    padding: 12,
                    borderRadius: 19,
                    borderWidth: 1,
                    borderColor: journal.border,
                    backgroundColor: pressed ? journal.mint : "#fff",
                    flexDirection: "row",
                    gap: 14,
                    alignItems: "center",
                  })}
                >
                  <View style={{ width: 66 }}>
                    <MediaFrame
                      uri={x.image_url}
                      label={x.name}
                      ratio={1}
                      corners={false}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        fontFamily: fonts.semibold,
                        fontSize: 16,
                        color: journal.ink,
                      }}
                    >
                      {x.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.regular,
                        fontSize: 12,
                        color: colors.inkSoft,
                      }}
                    >
                      {x.brand}
                    </Text>
                  </View>
                  <Check size={18} color={journal.green} />
                </Pressable>
              ))}
              {search.trim().length > 1 &&
              matches.isSuccess &&
              !results.length ? (
                <Note>
                  No match yet. Try the name on the label or identify it with a
                  product photo.
                </Note>
              ) : null}
            </JournalCard>
          </>
        ) : null}
        {d.step === 1 ? (
          <>
            <JournalCard
              title="Where are you with it?"
              detail="Used it once, finished a bottle, or still finding out? It all belongs here."
            >
              <ChoiceCards
                options={Object.entries(statusNames).map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={d.status}
                onChange={(status) => set({ status })}
              />
            </JournalCard>
            {d.status !== "purchased" ? (
              <JournalCard title="A little context makes the story yours.">
                <DurationPicker
                  value={d.duration}
                  onChange={(duration) => set({ duration })}
                />
                <Label>How often do you use it?</Label>
                <FilterChips
                  variant="chips"
                  options={[
                    "Once a day",
                    "Twice a day",
                    "A few times a week",
                    "Once a week",
                  ]}
                  value={d.frequency}
                  onChange={(frequency) => set({ frequency })}
                />
                {beauty ? (
                  <SkinTypeField
                    value={d.skin}
                    profileSkin={preference.data?.skin_type}
                    onChange={(skin) => set({ skin })}
                  />
                ) : null}
              </JournalCard>
            ) : null}
            {["paused", "stopped", "finished"].includes(d.status) ? (
              <JournalCard>
                <Input
                  label="Anything you want to note about stopping? (optional)"
                  value={d.reason}
                  onChange={(reason) => set({ reason })}
                />
              </JournalCard>
            ) : null}
            <ActionButton
              label="Continue to my experience"
              disabled={!p}
              onPress={next}
            />
          </>
        ) : null}
        {d.step === 2 ? (
          <>
            <JournalCard
              title={
                journeyId
                  ? "What has changed since last time?"
                  : "Your first chapter starts here."
              }
              detail="Good, disappointing, unchanged or unsure. Tell it in your own words."
            >
              <Input
                label="What have you noticed?"
                multiline
                value={d.body}
                onChange={(body) => set({ body })}
              />
              {d.status === "active" ? (
                <View
                  style={{
                    padding: 15,
                    borderRadius: 17,
                    backgroundColor: journal.mint,
                    gap: 6,
                  }}
                >
                  <Label>Keep the story going, at your pace.</Label>
                  <Note>
                    Come back after another week or month. Add a note, update
                    your routine, or compare your photos. There’s no streak to
                    keep.
                  </Note>
                </View>
              ) : null}
            </JournalCard>
            {beauty ? (
              <ComparisonPhotoCard
                value={d.skinPhoto}
                onChange={(skinPhoto) => set({ skinPhoto })}
              />
            ) : (
              <JournalCard>
                <PhotoField
                  label="Add an experience photo (optional)"
                  value={d.skinPhoto}
                  onChange={(skinPhoto) => set({ skinPhoto })}
                  camera
                />
              </JournalCard>
            )}
            <ActionButton label="Choose privacy & finish" onPress={next} />
          </>
        ) : null}
        {d.step === 3 ? (
          <>
            <JournalCard title="You decide what leaves your journal.">
              <PrivacyChoice
                value={d.visibility}
                onChange={(visibility) => set({ visibility })}
              />
            </JournalCard>
            {ownership.data && ownership.data.status !== "rejected" ? (
              <StatusMessage
                kind={ownership.data.status === "verified" ? "success" : "info"}
                title={
                  ownership.data.status === "verified"
                    ? "Ownership verified"
                    : "Product photo is awaiting review"
                }
                detail="The marker confirms reviewed ownership evidence. It does not endorse the product or verify the outcome."
              />
            ) : (
              <OwnershipPhotoCard
                value={d.ownership}
                onChange={(ownership) => set({ ownership })}
              />
            )}
            <JournalCard title="A reminder, only if it helps.">
              <ReminderFields
                logOn={d.logOn}
                routineOn={d.routineOn}
                time={d.time}
                onChange={set}
              />
            </JournalCard>
            <View
              style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: journal.mint,
                gap: 7,
              }}
            >
              <Label>Your journal is ready to begin.</Label>
              <Note>
                {d.visibility === "public"
                  ? "Your public updates can help someone else buy with more context."
                  : "A private space to understand your experience. You can choose to share later."}
              </Note>
            </View>
            <ActionButton
              label={
                d.visibility === "public"
                  ? "Save my public journal"
                  : "Save my private journal"
              }
              pending={busy}
              onPress={() => void save()}
            />
          </>
        ) : null}
      </Animated.View>
      {error ? (
        <StatusMessage
          kind="error"
          title="A small thing to finish"
          detail={error}
        />
      ) : null}
      {d.step > 0 ? (
        <ActionButton
          tone="ghost"
          label={d.step === 1 ? "Choose a different product" : "Back one step"}
          onPress={() => {
            setError("");
            set({ step: d.step - 1 });
          }}
        />
      ) : null}
    </AppShell>
  );
}
