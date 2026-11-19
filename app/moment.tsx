import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, View } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { AddProductSheet } from "@/components/moment/AddProductSheet";
import { ChooseMoment } from "@/components/moment/ChooseMoment";
import { MomentCaptureScreen } from "@/components/moment/MomentCaptureScreen";
import { MomentComposeScreen } from "@/components/moment/MomentComposeScreen";
import { MomentPreviewScreen } from "@/components/moment/MomentPreviewScreen";
import { MomentShareScreen } from "@/components/moment/MomentShareScreen";
import { needsUnmaskRender } from "@/lib/moment/render/needsRender";
import { renderUnmaskMedia } from "@/lib/moment/render/renderUnmask";
import { hapticSaved } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import {
  defaultMomentTitle,
  displayOccasion,
  initialMomentBatchDraft,
  draftHasMedia,
  normalizeMomentBatchDraft,
  type MomentAttachedProduct,
  type MomentBatchDraft,
  type MomentContext,
  type MomentMediaAsset,
} from "@/lib/moment/types";
import { pickDeviceMomentMedia } from "@/lib/moment/pickDeviceMomentMedia";
import { SAMPLE_TRENDS, selectedSoundDurationSec } from "@/lib/moment/creatorCatalog";
import { resolveStudioSoundUri, UNMASK_IMAGE_BGM_MAX_SEC } from "@/lib/moment/studioAudio";
import { pickPersistableMediaUri } from "@/lib/moment/safeMediaUri";
import { useTrackingDraft } from "@/lib/tracking/draft";
import { useAppStore } from "@/lib/store";

/** Capture → Compose → Preview → Share (mockup flow). */
export default function Moment() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trend?: string; story?: string }>();
  const uid = useAppStore((s) => s.profile?.id);
  const display = useAppStore((s) => s.profile?.displayName) || "You";
  const profileSkin = useAppStore((s) => (s.profile as { skin_type?: string; skinType?: string } | null)?.skin_type
    || (s.profile as { skinType?: string } | null)?.skinType);
  const add = useLocalMoments((s) => s.add);

  const storageKey = uid ? `unmask:moment-batch:${uid}` : "unmask:moment-batch:guest";
  const { value: draft, setValue: setDraft, ready, clear } = useTrackingDraft<MomentBatchDraft>(
    storageKey,
    initialMomentBatchDraft(),
  );
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [captureMode, setCaptureMode] = useState<"photo" | "video">("photo");
  const renderToken = useRef(0);

  const healedDraft = useRef(false);
  useEffect(() => {
    if (!ready || healedDraft.current) return;
    healedDraft.current = true;
    setDraft((d) => normalizeMomentBatchDraft(d));
  }, [ready, setDraft]);

  const storyBoot = useRef(false);
  useEffect(() => {
    if (!ready || storyBoot.current) return;
    if (String(params.story || "") !== "1") return;
    storyBoot.current = true;
    setDraft((d) =>
      normalizeMomentBatchDraft({
        ...d,
        productStory: true,
        kind: "currently",
        step: "capture",
        creator: {},
        context: {
          skinType: profileSkin || "Combination",
          usageFrequency: "Once daily (AM)",
          usageDuration: "Day 14",
        },
      }),
    );
  }, [ready, params.story, setDraft, profileSkin]);

  const trendApplied = useRef(false);
  useEffect(() => {
    if (!ready || trendApplied.current) return;
    const trend = params.trend ? String(params.trend) : null;
    if (!trend) return;
    if (draft.step !== "choose" || draft.kind) {
      trendApplied.current = true;
      return;
    }
    trendApplied.current = true;
    const t = SAMPLE_TRENDS.find((x) => x.id === trend);
    if (!t) return;
    setDraft((d) =>
      normalizeMomentBatchDraft({
        ...d,
        trendId: t.id,
        kind: t.momentKind,
        step: "capture",
        creator: { soundId: t.soundId },
        context: {
          skinType: profileSkin || "Combination",
          usageFrequency: "Once daily (AM)",
          usageDuration: "Day 14",
          ...(t.momentKind === "grwm" ? { occasion: "Date Night" } : {}),
        },
      }),
    );
  }, [ready, params.trend, draft.step, draft.kind, setDraft, profileSkin]);

  const patch = useCallback(
    (part: Partial<MomentBatchDraft>) => setDraft((d) => normalizeMomentBatchDraft({ ...d, ...part })),
    [setDraft],
  );

  const renderFingerprint = useMemo(
    () =>
      JSON.stringify({
        media: draft.originalMediaUri ?? draft.mediaUri,
        mediaKind: draft.mediaKind,
        context: draft.context,
        kind: draft.kind,
        caption: draft.caption,
        creator: draft.creator,
        brand: draft.step === "preview" || draft.step === "share",
      }),
    [draft.originalMediaUri, draft.mediaUri, draft.mediaKind, draft.context, draft.kind, draft.caption, draft.creator, draft.step],
  );

  const runRender = useCallback(
    async (opts?: { burnBranding?: boolean }) => {
      const snapshot = draft;
      if (!snapshot.mediaUri) return snapshot.mediaUri;
      const burnBranding = opts?.burnBranding ?? true;
      const input = { ...snapshot, burnBranding };
      if (!needsUnmaskRender(input)) {
        patch({ renderStatus: "ready", renderedMediaUri: snapshot.mediaUri, renderProgress: 1, renderError: "" });
        return snapshot.mediaUri;
      }
      const token = ++renderToken.current;
      patch({
        renderStatus: "processing",
        renderProgress: 0.02,
        renderError: "",
        renderLabel: "Creating your Unmask…",
      });
      try {
        const out = await renderUnmaskMedia(input, (ratio, label) => {
          if (token !== renderToken.current) return;
          patch({ renderProgress: ratio, renderLabel: label });
        });
        if (token !== renderToken.current) return snapshot.mediaUri;
        patch({
          renderedMediaUri: out.outputUri,
          renderStatus: "ready",
          renderProgress: 1,
          renderLabel: "Ready",
          coverPosterUri: out.posterUri ?? snapshot.coverPosterUri,
        });
        return out.outputUri;
      } catch (e) {
        if (token !== renderToken.current) return snapshot.mediaUri;
        patch({
          renderStatus: "error",
          renderError: e instanceof Error ? e.message : "Couldn’t finish Unmask export.",
          renderedMediaUri: undefined,
          renderProgress: 0,
        });
        return snapshot.mediaUri;
      }
    },
    [draft, patch],
  );

  useEffect(() => {
    if (!ready) return;
    if (draft.step !== "preview" && draft.step !== "share") return;
    if (draft.renderStatus === "processing") return;
    if (draft.renderStatus === "ready" && draft.renderedMediaUri) return;
    void runRender({ burnBranding: true }).catch(() => undefined);
  }, [ready, draft.step, renderFingerprint, runRender, draft.renderStatus, draft.renderedMediaUri]);

  const lastRenderFingerprint = useRef(renderFingerprint);
  useEffect(() => {
    if (lastRenderFingerprint.current === renderFingerprint) return;
    lastRenderFingerprint.current = renderFingerprint;
    if (draft.renderedMediaUri) {
      patch({ renderStatus: "idle", renderedMediaUri: undefined, renderError: "" });
    }
  }, [renderFingerprint, draft.renderedMediaUri, patch]);

  const defaultContext = useCallback(
    (kind: MomentKind, keep?: MomentContext): MomentContext => ({
      skinType: keep?.skinType || profileSkin || "Combination",
      usageFrequency: keep?.usageFrequency || "Once daily (AM)",
      usageDuration: keep?.usageDuration || "Day 14",
      occasion: kind === "grwm" ? keep?.occasion || "Date Night" : keep?.occasion,
      customOccasion: keep?.customOccasion,
      products: keep?.products,
      productName: keep?.productName,
      productImage: keep?.productImage,
      momentTitle: keep?.momentTitle || defaultMomentTitle(kind, false, keep?.occasion),
      experience: keep?.experience,
      confidence: keep?.confidence,
      location: keep?.location,
    }),
    [profileSkin],
  );

  const applyTrend = useCallback(
    (trendId: string) => {
      const t = SAMPLE_TRENDS.find((x) => x.id === trendId);
      if (!t) return;
      patch({
        trendId: t.id,
        kind: t.momentKind,
        productStory: false,
        step: "capture",
        creator: { soundId: t.soundId },
        context: defaultContext(t.momentKind),
      });
      setCaptureMode(momentConfig(t.momentKind).videoFirst ? "video" : "photo");
    },
    [patch, defaultContext],
  );

  const ingestMedia = useCallback(
    (asset: MomentMediaAsset, mk: "photo" | "video", source: "camera" | "device_upload") => {
      patch({
        mediaSource: source,
        mediaUri: asset.uri,
        originalMediaUri: asset.uri,
        mediaKind: mk,
        mediaAssets: [asset],
        coverPosterUri: asset.posterUri,
        step: "compose",
        renderStatus: "idle",
        renderedMediaUri: undefined,
        context: {
          ...defaultContext(draft.kind || "morning", draft.context),
          momentTitle:
            draft.context.momentTitle ||
            defaultMomentTitle(draft.kind, draft.productStory, displayOccasion(draft.context)),
        },
      });
    },
    [patch, draft.kind, draft.context, draft.productStory, defaultContext],
  );

  const uploadFromDevice = useCallback(async () => {
    if (!draft.kind) return;
    setImportError("");
    setImporting(true);
    try {
      const videosOnly = captureMode === "video";
      const result = await pickDeviceMomentMedia({
        videoFirst: videosOnly || Boolean(momentConfig(draft.kind).videoFirst),
        videosOnly,
        photosOnly: captureMode === "photo",
      });
      if (!result.ok) {
        if (result.reason !== "cancelled" && result.message) setImportError(result.message);
        return;
      }
      const asset = { ...result.asset };
      if (asset.kind === "video" && Platform.OS !== "web") {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0 });
          asset.posterUri = thumb.uri;
        } catch {
          /* optional */
        }
      }
      ingestMedia(asset, result.mediaKind, "device_upload");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Upload failed. Try a shorter MP4.");
    } finally {
      setImporting(false);
    }
  }, [draft.kind, captureMode, ingestMedia]);

  const setContext = useCallback((context: MomentContext) => setDraft((d) => ({ ...d, context })), [setDraft]);

  const attachProduct = useCallback((p: MomentAttachedProduct) => {
    setDraft((d) => {
      const list = d.context.products ?? [];
      if (list.some((x) => x.productId === p.productId)) return d;
      return {
        ...d,
        context: {
          ...d.context,
          products: [...list, p],
          productName: p.name,
          productImage: p.image,
        },
        productSheetOpen: false,
      };
    });
  }, [setDraft]);

  const resetFlow = useCallback(async () => {
    try {
      await clear();
    } catch {
      /* ignore */
    }
    setDraft(initialMomentBatchDraft());
    setPublishError("");
    setImportError("");
  }, [clear, setDraft]);

  const pickKind = (k: MomentKind) => {
    const keepMedia = draft.kind === k && draftHasMedia(draft) && !draft.productStory;
    patch({
      draftId: keepMedia ? draft.draftId : `draft-${Date.now()}`,
      kind: k,
      productStory: false,
      step: "capture",
      ...(keepMedia
        ? {}
        : {
            mediaUri: "",
            mediaAssets: [],
            originalMediaUri: undefined,
            coverTimeMs: undefined,
            coverPosterUri: undefined,
            mediaSource: "camera" as const,
            creator: {},
          }),
      context: defaultContext(k, keepMedia ? draft.context : undefined),
    });
    setCaptureMode(momentConfig(k).videoFirst ? "video" : "photo");
  };

  const startProductStory = () => {
    patch({
      draftId: `draft-${Date.now()}`,
      kind: "currently",
      productStory: true,
      step: "capture",
      mediaUri: "",
      mediaAssets: [],
      originalMediaUri: undefined,
      creator: {},
      context: {
        ...defaultContext("currently"),
        momentTitle: "My Product Story",
      },
    });
    setCaptureMode("photo");
  };

  const confirmDiscard = (onYes: () => void) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Discard this Unmask draft?")) onYes();
      return;
    }
    Alert.alert("Discard draft?", "Your capture and products will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onYes },
    ]);
  };

  const post = async () => {
    const { kind, context, saveToJourney, audience } = draft;
    if (!kind || !draft.mediaUri || publishing) return;
    setPublishing(true);
    setPublishError("");
    try {
      // Prefer baked Unmask card for status + export so overlays stick
      let publishUri = draft.renderedMediaUri ?? draft.mediaUri;
      if (draft.renderStatus !== "ready" || !draft.renderedMediaUri) {
        try {
          publishUri = (await runRender({ burnBranding: true })) || draft.mediaUri;
        } catch {
          publishUri = draft.mediaUri;
        }
      }
      // For in-app video playback quality, keep original video URI when bake failed to image/static
      const playUri =
        draft.mediaKind === "video" && (!publishUri || publishUri === draft.mediaUri)
          ? draft.originalMediaUri || draft.mediaUri
          : publishUri;
      const statusUri = pickPersistableMediaUri(playUri, draft.originalMediaUri || draft.mediaUri);

      const products = context.products ?? [];
      for (const p of products) {
        try {
          await living.registerProduct({
            id: p.productId,
            name: p.name,
            brand: p.brand || "",
            category: p.category || "",
            heroImageUrl: p.image,
          });
        } catch {
          /* offline */
        }
      }
      if (saveToJourney && uid && products[0]) {
        const primary = products[0];
        try {
          await living.saveJourney(
            { product_id: primary.productId, acquisition: "purchased", status: "active", visibility: "private" },
            primary.journeyId ? { journeyId: primary.journeyId } : { createNew: true },
          );
        } catch {
          /* optional */
        }
      }

      const config = momentConfig(kind);
      const occasion = displayOccasion(context);
      const caption =
        (draft.caption ?? "").trim() ||
        context.experience?.trim() ||
        [draft.productStory ? "Product Story" : config.title, occasion, context.productName].filter(Boolean).join(" · ") ||
        config.tagline;

      add({
        photo: statusUri,
        caption,
        author: display,
        productName: context.productName,
        productIds: products.map((p) => p.productId),
        productLabels: products.map((p) => (p.brand ? `${p.brand} ${p.name}` : p.name)),
        productImages: products.map((p) => p.image || "").filter(Boolean),
        momentTitle: context.momentTitle || defaultMomentTitle(kind, draft.productStory, occasion),
        skinType: context.skinType,
        usageFrequency: context.usageFrequency,
        usageDuration: context.usageDuration,
        timelineId: context.timelineId,
        timelineLabel: context.timelineLabel,
        destination: "story",
        mediaKind: draft.mediaKind,
        momentKind: kind,
        occasion,
        routineTags: context.routineTags,
        audience,
        saveToJourney,
        stickers: [
          draft.productStory ? "Product Story 📖" : `${config.title} ${config.emoji}`,
          occasion,
        ].filter(Boolean) as string[],
        trendId: draft.trendId,
        mediaSource: draft.mediaSource,
        coverPosterUri: pickPersistableMediaUri(draft.coverPosterUri, statusUri),
        soundUri: draft.mediaKind === "photo" ? resolveStudioSoundUri(draft.creator) || undefined : undefined,
        soundMaxMs:
          draft.mediaKind === "photo"
            ? Math.min(UNMASK_IMAGE_BGM_MAX_SEC, selectedSoundDurationSec(draft.creator) ?? UNMASK_IMAGE_BGM_MAX_SEC) *
              1000
            : undefined,
        slideCaptions: draft.mediaAssets.map((a) => a.caption || "").filter(Boolean),
      });
      hapticSaved("moment");
      try {
        await clear();
      } catch {
        /* optional */
      }
      setDraft(initialMomentBatchDraft());
      router.replace("/community" as Href);
    } catch (e) {
      const detail =
        e instanceof Error && e.name === "QuotaExceededError"
          ? "Storage is full — try a smaller photo or clear old drafts."
          : "Publish didn’t finish. Your draft is still here — tap Publish to retry.";
      setPublishError(detail);
    } finally {
      setPublishing(false);
    }
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: "#FFF1ED" }} />;

  const previewUri =
    draft.renderStatus === "ready" && draft.renderedMediaUri && draft.mediaKind === "photo"
      ? draft.renderedMediaUri
      : draft.mediaUri;

  if (draft.step === "choose") {
    return (
      <ChooseMoment
        onPick={pickKind}
        onStartCamera={() => pickKind("grwm")}
        onJoinTrend={applyTrend}
        onBack={() => router.back()}
        onProductStory={startProductStory}
      />
    );
  }

  if (draft.step === "capture" && draft.kind) {
    return (
      <MomentCaptureScreen
        kind={draft.kind}
        productStory={draft.productStory}
        mediaMode={captureMode}
        onMediaModeChange={setCaptureMode}
        importing={importing}
        importError={importError}
        onBack={() => patch({ step: "choose", productStory: false })}
        onClose={() =>
          confirmDiscard(() => {
            void resetFlow();
            router.back();
          })
        }
        onTakePhoto={(uri) => {
          const asset: MomentMediaAsset = { id: `cap-${Date.now()}`, uri, kind: "photo", source: "camera" };
          ingestMedia(asset, "photo", "camera");
        }}
        onUpload={() => void uploadFromDevice()}
      />
    );
  }

  if (draft.step === "compose" && draft.kind && draft.mediaUri) {
    return (
      <View style={{ flex: 1 }}>
        <MomentComposeScreen
          kind={draft.kind}
          productStory={draft.productStory}
          mediaUri={draft.mediaUri}
          mediaKind={draft.mediaKind}
          mediaAssets={draft.mediaAssets}
          context={draft.context}
          caption={draft.caption ?? ""}
          onKindChange={(kind) =>
            patch({
              kind,
              context: {
                ...draft.context,
                momentTitle: defaultMomentTitle(kind, false, displayOccasion(draft.context)),
              },
            })
          }
          onContextChange={setContext}
          onCaptionChange={(caption) => patch({ caption })}
          onOpenProducts={() => patch({ productSheetOpen: true })}
          onBack={() => patch({ step: "capture" })}
          onRecapture={() => patch({ step: "capture" })}
          onNext={() => patch({ step: "preview" })}
        />
        <AddProductSheet
          open={draft.productSheetOpen}
          onClose={() => patch({ productSheetOpen: false })}
          attached={draft.context.products ?? []}
          onAttach={attachProduct}
        />
      </View>
    );
  }

  if (draft.step === "preview" && draft.kind && draft.mediaUri) {
    return (
      <MomentPreviewScreen
        kind={draft.kind}
        productStory={draft.productStory}
        mediaUri={draft.mediaUri}
        mediaKind={draft.mediaKind}
        posterUri={draft.coverPosterUri}
        context={draft.context}
        caption={draft.caption ?? ""}
        creator={draft.creator}
        audience={draft.audience}
        processing={draft.renderStatus === "processing"}
        processingLabel={draft.renderLabel}
        onCreatorChange={(creator) => patch({ creator, renderStatus: "idle", renderedMediaUri: undefined })}
        onAudienceChange={(audience) => patch({ audience })}
        onBack={() => patch({ step: "compose" })}
        onEditCompose={() => patch({ step: "compose" })}
        onPublish={() => void post()}
        onShareOutside={() => patch({ step: "share" })}
        publishing={publishing}
      />
    );
  }

  if (draft.step === "share" && draft.kind && draft.mediaUri) {
    return (
      <MomentShareScreen
        kind={draft.kind}
        productStory={draft.productStory}
        mediaUri={previewUri}
        mediaKind={draft.mediaKind}
        posterUri={draft.coverPosterUri}
        context={draft.context}
        creator={draft.creator}
        renderHint={
          draft.renderStatus === "error"
            ? draft.renderError
            : draft.renderStatus === "processing"
              ? draft.renderLabel
              : undefined
        }
        caption={draft.caption ?? ""}
        onCaptionChange={(caption) => patch({ caption })}
        onOpenProducts={() => patch({ step: "compose", productSheetOpen: true })}
        onBack={() => patch({ step: "preview" })}
        onPublish={() => void post()}
        onExportShare={async () => {
          const uri = await runRender({ burnBranding: true });
          return uri || previewUri;
        }}
        onSaveDraft={() => {
          hapticSaved("moment");
          patch({ step: "choose" });
          router.replace("/" as Href);
        }}
        publishing={publishing}
        publishError={publishError}
        saveToJourney={draft.saveToJourney}
        onToggleJourney={(v) => patch({ saveToJourney: v })}
        audience={draft.audience}
        onAudienceChange={(audience) => patch({ audience })}
      />
    );
  }

  return (
    <ChooseMoment
      onPick={pickKind}
      onStartCamera={() => pickKind("grwm")}
      onJoinTrend={applyTrend}
      onBack={() => router.back()}
      onProductStory={startProductStory}
    />
  );
}
