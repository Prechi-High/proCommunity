import { durablePhoto } from "@/lib/tracking/photos";
import { SkinProgressExample } from "./SkinProgressExample";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionSheet,
  AppShell,
  ActionButton,
  ContentSkeleton,
  FilterChips,
  MediaFrame,
  SearchField,
  StatusMessage,
} from "@/components/unmask-ui";
import { Toggle } from "@/components/unmask-ui/Toggle";
import { Camera, Check, Globe, Lock } from "@/components/icons";
import {
  JournalCard,
  JournalProduct,
  JournalProgress,
  ChoiceCards,
  DurationPicker,
  ComparisonPhotoCard,
  OwnershipPhotoCard,
  journal,
} from "./JournalUI";
import { Input, Label, Note, PhotoField, statusNames } from "./Fields";
import { SkinTypeField } from "./SkinTypeField";
import { EvidencePicker } from "./EvidencePicker";
import { useTrackingDraft } from "@/lib/tracking/draft";
import * as tracking from "@/lib/tracking/api";
import * as living from "@/lib/living/api";
import * as clarity from "@/lib/clarity/api";
import * as community from "@/lib/community-v2/api";
import { useAppStore } from "@/lib/store";
import { getKnownProduct } from "@/lib/products";
import { useScan } from "@/lib/useScan";
import { exactCommunityMatch } from "@/lib/unmask/productIdentityMatch";
import { searchCommunityProducts } from "@/lib/unmask/communitySearch";
import { hapticSaved } from "@/lib/haptics";
import { colors, fonts } from "@/constants/theme";
import type { ProductState } from "@/lib/living/types";

export function ExperienceWizard({
  productId = "",
  source,
  initialJourney = "",
  resumeGuest,
}: {
  productId?: string;
  source?: clarity.Experience;
  initialJourney?: string;
  resumeGuest?: string;
}) {
  const uid = useAppStore((s) => s.profile?.id),
    r = useRouter(),
    qc = useQueryClient();
  const [confirmShare, setConfirmShare] = useState(false);
  const [editContext, setEditContext] = useState(false);
  const [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<{
      id: string;
      visibility: string;
      journalId?: string;
      proofStatus?: "pending" | "submitted" | "failed";
    } | null>(null);
  const keyId = source?.id || productId || "new";
  const draft = useTrackingDraft(
    `unmask:experience-v2:${uid || "guest"}:${keyId}`,
    {
      step: productId ? 1 : 0,
      product: productId,
      productName: "",
      productBrand: "",
      productCategory: "",
      productImage: "",
      capturedProduct: "",
      status: source
        ? Object.keys(statusNames).find(
            (k) => statusNames[k] === source.usage_status && k !== "purchased",
          ) || "active"
        : "active",
      duration: source?.duration || "",
      frequency: source?.frequency || "",
      skin: source?.skin_type || "",
      body: "",
      reason: "",
      skinPhoto: "",
      ownership: "",
      track: true,
      visibility: "private",
      attachment: null as tracking.EvidenceSelection | null,
      experienceId: tracking.operationId(),
      updateId: tracking.operationId(),
      journalId: "",
      photoPath: "",
      trackingPhotoPath: "",
    },
    uid && resumeGuest
      ? `unmask:experience-v2:guest:${resumeGuest}`
      : undefined,
  );
  const d = draft.value,
    set = (patch: Partial<typeof d>) =>
      draft.setValue((v) => ({ ...v, ...patch }));
  const reduce = useReducedMotion(),
    seededSkin = useRef(false);
  const pref = useQuery({
    queryKey: ["tracking-skin", uid],
    queryFn: clarity.preferences,
    enabled: !!uid,
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
  const matches = useQuery({
    queryKey: ["experience-product-search", search],
    queryFn: () => searchCommunityProducts(search),
    enabled: search.trim().length > 1,
  });
  const owned = useQuery({
    queryKey: ["living", "journeys", uid],
    queryFn: living.journeys,
    enabled: !!uid,
  });
  const linked = useQuery({
    queryKey: ["experience-linked-journey", d.attachment?.id, uid],
    queryFn: () =>
      living.journey(d.attachment!.id) as Promise<tracking.TrackedJourney>,
    enabled: d.attachment?.kind === "journey",
    initialData: () =>
      owned.data?.find((j) => j.id === d.attachment?.id) as
        tracking.TrackedJourney | undefined,
    staleTime: 60000,
  });
  const sources = useQuery({
    queryKey: ["evidence-options", uid],
    queryFn: tracking.attachmentOptions,
    enabled: !!uid && !!initialJourney,
  });
  useEffect(() => {
    if (draft.ready && pref.data && !seededSkin.current) {
      seededSkin.current = true;
      if (!draft.restored && !d.skin && pref.data.skin_type)
        set({ skin: pref.data.skin_type });
    }
  }, [draft.ready, pref.data, draft.restored]);
  useEffect(() => {
    if (draft.ready && initialJourney && !d.attachment) {
      const entry = sources.data?.find(
        (x) => x.kind === "journey" && x.id === initialJourney,
      );
      if (entry)
        set({
          attachment: entry,
          ...(entry.usage
            ? {
                duration: entry.usage.duration,
                frequency: entry.usage.frequency,
                skin: entry.usage.skin || d.skin,
                status: entry.usage.status,
              }
            : {}),
        });
    }
  }, [draft.ready, initialJourney, sources.data]);
  const hydratedLink = useRef("");
  useEffect(() => {
    if (
      linked.data &&
      linked.data.product_id === d.product &&
      linked.data.user_id === uid &&
      d.step === 1 &&
      !editContext &&
      linked.data.id !== hydratedLink.current
    ) {
      hydratedLink.current = linked.data.id;
      const j = linked.data;
      set({
        duration: j.usage_duration || d.duration,
        frequency: j.frequency || d.frequency,
        skin: j.skin_type || d.skin,
        status: j.status === "purchased" ? "active" : j.status,
      });
    }
  }, [linked.data]);
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
            image_url: d.productImage,
          }
        : undefined);
  const beauty =
    /skin|beauty|cosmetic|body|hair|face|cream|serum|cleanser/i.test(
      `${p?.category || ""} ${p?.name || ""}`,
    );
  const myJourney = owned.data?.find((x) => x.product_id === d.product) as
    tracking.TrackedJourney | undefined;
  const trackingOn = d.status === "active" && d.track;
  function resetForProduct(id: string): Partial<typeof d> {
    return id === d.product
      ? {}
      : {
          duration: "",
          frequency: "",
          body: "",
          reason: "",
          skinPhoto: "",
          photoPath: "",
          trackingPhotoPath: "",
          journalId: "",
          status: "active",
          experienceId: tracking.operationId(),
          updateId: tracking.operationId(),
        };
  }
  const scan = useScan({
    onSelect: async (product, photo) => {
      try {
        photo = await durablePhoto(photo);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      try {
        product =
          exactCommunityMatch(
            product,
            await searchCommunityProducts(product.name),
          ) || product;
      } catch {}
      set({
        ...resetForProduct(product.id),
        product: product.id,
        productName: product.name,
        productBrand: product.brand,
        productCategory: product.category,
        productImage: product.heroImageUrl || photo,
        capturedProduct: photo,
        ownership: photo,
        attachment: null,
        step: 1,
      });
    },
  });
  function next() {
    if (d.step === 1 && (!d.duration.trim() || !d.frequency)) {
      setError("Choose how long and how often you used it.");
      return;
    }
    if (d.step === 2 && d.body.trim().length < 10) {
      setError("A short experience of at least 10 characters is enough.");
      return;
    }
    setError("");
    set({ step: Math.min(3, d.step + 1) });
  }
  async function save(
    visibility: "private" | "public",
    confirmPrivate = false,
  ) {
    if (busy) return;
    if (!uid) {
      r.push({
        pathname: "/(auth)/sign-in",
        params: {
          returnTo: `/contribute?product=${encodeURIComponent(productId)}&resumeGuest=${encodeURIComponent(keyId)}`,
        },
      } as Href);
      return;
    }
    if (!p || d.body.trim().length < 10 || !d.duration || !d.frequency) {
      setError("Finish your product, usage details and experience first.");
      return;
    }
    if (
      visibility === "public" &&
      d.attachment &&
      d.attachment.visibility !== "public" &&
      !confirmPrivate
    ) {
      setConfirmShare(true);
      return;
    }
    if (trackingOn && (owned.isLoading || owned.isError)) {
      setError(
        "We couldn’t check your existing timelines yet. Retry that check, or turn off ongoing tracking to save only your experience.",
      );
      return;
    }
    setBusy(true);
    setError("");
    set({ visibility });
    let savingStage = "prepare your attachment";
    try {
      let attached = d.attachment;
      // Re-check the source at save time. A private source is never silently published.
      if (
        visibility === "public" &&
        attached &&
        attached.visibility !== "public"
      ) {
        attached = await tracking.shareAttachment(attached);
        set({ attachment: attached });
      }
      savingStage = "save the product";
      await living.registerProduct({
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        category: p.category || "Product",
        heroImageUrl:
          p.image_url && /^https?:/.test(p.image_url) ? p.image_url : null,
      });
      savingStage = "upload your experience photo";
      let photoPath = d.photoPath;
      if (d.skinPhoto && !photoPath) {
        photoPath = await community.uploadPhoto(d.skinPhoto);
        set({ photoPath });
      }
      let journalId = d.journalId;
      if (trackingOn) {
        savingStage = "save your product timeline";
        const existingJournal =
          myJourney && myJourney.id !== d.journalId ? myJourney : null;
        const j =
          existingJournal ||
          (await living.saveJourney({
            product_id: p.id,
            acquisition: "purchased",
            status: d.status as ProductState,
            frequency: d.frequency,
            usage_duration: d.duration,
            skin_type: d.skin || null,
            visibility: "private",
          } as Partial<tracking.TrackedJourney> & {
            product_id: string;
            acquisition: string;
          }));
        journalId = j.id;
        if (!existingJournal) {
          set({ journalId });
          let historyPhoto = d.trackingPhotoPath;
          if (d.skinPhoto && !historyPhoto) {
            historyPhoto = await living.uploadPhoto(d.skinPhoto);
            set({ trackingPhotoPath: historyPhoto });
          }
          await tracking.logUsage(j.id, d.updateId, {
            body: d.body.trim(),
            duration: d.duration,
            frequency: d.frequency,
            skin_type: d.skin,
            status: d.status,
            reason: d.reason,
            visibility: "private",
            photo_path: historyPhoto || null,
          });
        }

      }
      savingStage = "publish your experience";
      const out = await clarity.saveExperience(
        {
          product_id: p.id,
          body: d.body.trim(),
          duration: d.duration,
          frequency: d.frequency,
          usage_status: statusNames[d.status] || "Used before",
          skin_type: d.skin || null,
          visibility,
          photo_path: photoPath || null,
          goal: "",
          outcome: "Not stated",
          uncertainty: "",
          context: d.reason,
          acquisition: "Prefer not to say",
          would_rebuy: "Not stated",
          attached_journey_id:
            attached?.kind === "journey" ? attached.id : null,
          attached_experience_id:
            attached?.kind === "experience" ? attached.id : null,
        },
        undefined,
        d.experienceId,
      );
      await draft.clear();
      await qc.invalidateQueries();
      hapticSaved(out.id);
      setDone({
        id: out.id,
        visibility,
        journalId: trackingOn ? journalId : undefined,
        proofStatus: trackingOn && journalId && d.ownership ? "pending" : undefined,
      });
      // Ownership verification is optional and separate from publishing.
      // Show the successful post immediately, even if proof upload fails.
      if (trackingOn && journalId && d.ownership) {
        const proofJournal = journalId;
        void (async () => {
          try {
            const proof = await tracking.proof(proofJournal);
            if (!proof)
              await tracking.submitProof(
                proofJournal,
                await tracking.uploadProof(d.ownership),
              );
            setDone((current) => current?.id === out.id
              ? { ...current, proofStatus: "submitted" } : current);
            void qc.invalidateQueries({ queryKey: ["ownership-proof", proofJournal] });
          } catch {
            setDone((current) => current?.id === out.id
              ? { ...current, proofStatus: "failed" } : current);
          }
        })();
      }
    } catch (e) {
      const message = (e as Error).message || "";
      setError(/failed to fetch|network request failed|load failed/i.test(message)
        ? `We couldn’t ${savingStage}. Check your connection and try again. Your draft is safe.`
        : message || "Your draft is safe. Try saving again.");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <AppShell
        back
        navigation
        title={
          done.visibility === "public"
            ? "Your experience is out there."
            : "Saved just for you."
        }
      >
        <StatusMessage
          kind="success"
          title={
            done.visibility === "public"
              ? "Posted to the community"
              : "Experience saved privately"
          }
          detail={
            done.visibility === "public"
              ? "Other Unmaskers can see your experience and reply."
              : "Only you can see this experience. Share it whenever you’re ready."
          }
        />
        {done.proofStatus ? (
          <Note>
            {done.proofStatus === "failed"
              ? "Your experience is saved. The optional ownership photo couldn’t upload. You can add it later from your product timeline."
              : done.proofStatus === "pending"
                ? "Your experience is saved. Your optional ownership photo is uploading separately."
                : "Ownership photo received. A marker appears only after review."}
          </Note>
        ) : null}
        <ActionButton
          label="View my experience"
          onPress={() => r.replace(`/story/${done.id}` as Href)}
        />
        {done.journalId ? (
          <ActionButton
            tone="secondary"
            label="Open my product timeline"
            onPress={() => r.push(`/journey/${done.journalId}` as Href)}
          />
        ) : null}
        {done.visibility === "public" ? (
          <ActionButton
            tone="ghost"
            label="Take this further with Ultra Unmask"
            onPress={() =>
              r.push(
                `/investigation/request?product=${d.product}&experience=${done.id}` as Href,
              )
            }
          />
        ) : null}
      </AppShell>
    );
  if (!draft.ready)
    return (
      <AppShell back title="Opening your experience…">
        <ContentSkeleton />
      </AppShell>
    );
  const rows =
    search.trim().length > 1
      ? (matches.data ?? []).map((x) => ({ ...x, image_url: x.heroImageUrl }))
      : (cat.data ?? []);
  return (
    <AppShell
      back
      navigation
      scrollResetKey={d.step}
      title="Tell your product story."
      subtitle="What you used. How you used it. What happened."
    >
      <JournalProgress
        step={d.step}
        labels={["Product", "Your use", "Experience", "Share"]}
      />
      {d.step > 0 ? (
        p ? (
          <JournalProduct
            eyebrow="YOUR PRODUCT EXPERIENCE"
            name={p.name}
            brand={p.brand}
            image={d.productImage || p.image_url}
          />
        ) : (
          <ContentSkeleton rows={1} />
        )
      ) : null}
      {scan.sheet}
      <ActionSheet
        open={confirmShare}
        onClose={() => setConfirmShare(false)}
        title="Share the private attachment too?"
      >
        <Note>
          {d.attachment?.kind === "journey"
            ? "Publishing with this timeline makes its journal, existing notes, routine and progress photos public. Your ownership proof photo stays private."
            : "Publishing with this experience makes the original experience public too. Its author keeps the credit."}
        </Note>
        <ActionButton
          label="Make public & publish my post"
          onPress={() => {
            setConfirmShare(false);
            void save("public", true);
          }}
        />
        <ActionButton
          tone="ghost"
          label="Keep private and go back"
          onPress={() => setConfirmShare(false)}
        />
      </ActionSheet>
      <Animated.View
        key={d.step}
        entering={reduce ? undefined : FadeIn.duration(180)}
        style={{ gap: 18 }}
      >
        {d.step === 0 ? (
          <JournalCard
            title="Which product did you try?"
            detail="Search by name, or take a photo and confirm the match."
          >
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search product name or brand"
            />
            <ActionButton
              tone="secondary"
              label="Identify my product with a photo"
              icon={<Camera size={20} color={colors.ink} />}
              onPress={scan.openCamera}
            />
            {(search.trim().length > 1 ? matches.isLoading : cat.isLoading) ? (
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
            {rows.slice(0, 12).map((x) => (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={`Share experience with ${x.name}`}
                onPress={() =>
                  set({
                    ...resetForProduct(x.id),
                    product: x.id,
                    productName: x.name,
                    productBrand: x.brand || "",
                    productCategory: x.category || "",
                    productImage: x.image_url || "",
                    capturedProduct: "",
                    ownership: "",
                    attachment: null,
                    step: 1,
                  })
                }
                style={{
                  flexDirection: "row",
                  gap: 12,
                  padding: 12,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.line,
                  alignItems: "center",
                }}
              >
                <View style={{ width: 60 }}>
                  <MediaFrame uri={x.image_url} label={x.name} ratio={1} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 16,
                      color: colors.ink,
                    }}
                  >
                    {x.name}
                  </Text>
                  <Note>{x.brand}</Note>
                </View>
              </Pressable>
            ))}
            {search.trim().length > 1 && matches.isSuccess && !rows.length ? (
              <Note>
                No match yet. Try the name on the label, or use a product photo.
              </Note>
            ) : null}
          </JournalCard>
        ) : null}
        {d.step === 1 ? (
          <>
            <JournalCard
              title="Already kept a product timeline?"
              detail="Bring it along so you don’t have to enter the same usage details again."
            >
              <EvidencePicker
                value={d.attachment?.kind === "journey" ? d.attachment : null}
                onChange={(attachment) => {
                  setEditContext(false);
                  hydratedLink.current = "";
                  const usage = attachment?.usage;
                  set({
                    attachment,
                    ...(usage
                      ? {
                          duration: usage.duration,
                          frequency: usage.frequency,
                          skin: usage.skin || d.skin,
                          status: usage.status,
                        }
                      : {}),
                  });
                }}
                productId={d.product}
                kind="journey"
                publicPost={false}
                buttonLabel={
                  d.attachment?.kind === "journey"
                    ? "Change my product timeline"
                    : "Attach my existing product timeline"
                }
              />
            </JournalCard>
            {d.attachment?.kind === "journey" && !editContext ? (
              <JournalCard title="Your usage details are already here.">
                {d.duration && d.frequency ? (
                  <>
                    <Label>
                      {statusNames[d.status] || "Used before"} · {d.duration}
                    </Label>
                    <Note>
                      {d.frequency}
                      {d.skin ? ` · ${d.skin} skin` : ""}
                    </Note>
                  </>
                ) : linked.isLoading ? (
                  <ContentSkeleton rows={1} />
                ) : (
                  <Note>
                    Some usage details haven’t been recorded on this timeline
                    yet. You can add them below.
                  </Note>
                )}
                {linked.isError ? (
                  <ActionButton
                    tone="secondary"
                    label="Retry timeline details"
                    onPress={() => void linked.refetch()}
                  />
                ) : null}
                <ActionButton
                  tone="ghost"
                  label="Edit usage details"
                  onPress={() => setEditContext(true)}
                />
              </JournalCard>
            ) : (
              <JournalCard title="Where are you with this product?">
                <ChoiceCards
                  options={Object.entries(statusNames)
                    .filter(([value]) => value !== "purchased")
                    .map(([value, label]) => ({ value, label }))}
                  value={d.status}
                  onChange={(status) => set({ status })}
                />
                <DurationPicker
                  value={d.duration}
                  onChange={(duration) => set({ duration })}
                />
                <Label>How often did you use it?</Label>
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
                    profileSkin={pref.data?.skin_type}
                    onChange={(skin) => set({ skin })}
                  />
                ) : null}
                {["paused", "stopped", "finished"].includes(d.status) ? (
                  <Input
                    label="Anything to add about pausing or stopping? (optional)"
                    value={d.reason}
                    onChange={(reason) => set({ reason })}
                  />
                ) : null}
              </JournalCard>
            )}
            <ActionButton
              label="Continue to my experience"
              disabled={
                !p ||
                (d.attachment?.kind === "journey" &&
                  !editContext &&
                  (!d.duration || !d.frequency))
              }
              onPress={next}
            />
          </>
        ) : null}
        {d.step === 2 ? (
          <>
            <JournalCard
              title="What was it like for you?"
              detail="Good, disappointing, unchanged or still unsure. Your experience belongs here."
            >
              <Input
                label="My product experience"
                value={d.body}
                onChange={(body) => set({ body })}
                multiline
              />
              {d.attachment?.kind === "journey" ? (
                <Note>
                  Your product usage timeline is attached. You can change it in
                  the previous step.
                </Note>
              ) : null}
            </JournalCard>
            <JournalCard
              title="Want to show what you noticed?"
              detail={
                beauty
                  ? "Optional. Take a photo of your skin now. Photos from later updates can sit alongside it so you can compare what changed—or stayed the same—over time."
                  : "Optional. Add a photo to help tell your product story."
              }
            >
              {beauty ? <SkinProgressExample /> : null}
              <PhotoField
                label="Add an experience photo (optional)"
                value={d.skinPhoto}
                onChange={(skinPhoto) =>
                  set({ skinPhoto, photoPath: "", trackingPhotoPath: "" })
                }
                camera
              />
              {beauty ? (
                <Note>
                  If you keep updating, take later photos in similar light and
                  from the same angle to compare changes. Photos are a visual
                  record, not a diagnosis.
                </Note>
              ) : null}
            </JournalCard>
            <ActionButton label="Choose how to save or share" onPress={next} />
          </>
        ) : null}
        {d.step === 3 ? (
          <>
            <JournalCard title="Keep it, or let it help someone.">
              <Note>
                Save privately to keep this experience for yourself. Publish as
                a post to let other Unmaskers see your words, selected photo and
                attached experience, and reply.
              </Note>
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <Lock size={18} color={colors.ink} />
                <Note>
                  Your ownership proof photo is never part of a public post.
                </Note>
              </View>
            </JournalCard>
            {d.status === "active" ? (
              <JournalCard title="Still using it? Keep your story going.">
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View style={{ flex: 1, gap: 5 }}>
                    <Label>Keep updating my experience</Label>
                    <Note>
                      {myJourney
                        ? "You already have a timeline for this product. We’ll keep it as it is; you can add your next update there."
                        : "On by default. Start a private product timeline with this experience, then add notes, routine changes and comparison photos later. No need to start again."}
                    </Note>
                  </View>
                  <Toggle
                    label="Keep updating my experience"
                    value={d.track}
                    onChange={(track) => set({ track })}
                  />
                </View>
              </JournalCard>
            ) : null}
            {trackingOn ? (
              d.capturedProduct ? (
                <JournalCard
                  title="Your product photo is already here."
                  detail="We’ll reuse it for ownership review. No second photo needed."
                >
                  <View style={{ width: 90 }}>
                    <MediaFrame
                      uri={d.capturedProduct}
                      label="Your product photo"
                      ratio={1}
                    />
                  </View>
                  <Note>A reviewed marker appears only after review.</Note>
                </JournalCard>
              ) : (
                <OwnershipPhotoCard
                  value={d.ownership}
                  onChange={(ownership) => set({ ownership })}
                />
              )
            ) : null}
            {d.attachment ? (
              <JournalCard title="The experience you’re bringing along">
                <EvidencePicker
                  value={d.attachment}
                  onChange={(attachment) => set({ attachment })}
                  publicPost
                />
                <Note>
                  {d.attachment.visibility === "public"
                    ? "This source is public and can be included in your post."
                    : "This source is private. We’ll ask you to confirm before making it public with your post. Saving privately needs no change."}
                </Note>
              </JournalCard>
            ) : null}
            {trackingOn && owned.isError ? (
              <ActionButton
                tone="secondary"
                label="Retry my timeline check"
                onPress={() => void owned.refetch()}
              />
            ) : null}
            <ActionButton
              label="Publish as a post"
              pending={busy && d.visibility === "public"}
              disabled={busy}
              pendingLabel="Saving…"
              icon={<Globe size={20} color="#fff" />}
              onPress={() => void save("public")}
            />
            <Note>
              Public means other users can see your experience and reply.
            </Note>
            <ActionButton
              tone="secondary"
              label="Save experience privately"
              pending={busy && d.visibility === "private"}
              disabled={busy}
              pendingLabel="Saving…"
              onPress={() => void save("private")}
            />
          </>
        ) : null}
      </Animated.View>
      {error ? (
        <StatusMessage
          kind="error"
          title="Let’s finish this step"
          detail={error}
        />
      ) : null}
      {d.step > 0 ? (
        <ActionButton
          tone="ghost"
          label={d.step === 1 ? "Choose a different product" : "Back one step"}
          disabled={busy}
          onPress={() => {
            setError("");
            set({ step: d.step - 1 });
          }}
        />
      ) : null}
      <Note>
        Your draft saves on this device as you go.
        {!uid ? " Sign in when you’re ready to save or publish." : ""}
      </Note>
    </AppShell>
  );
}
