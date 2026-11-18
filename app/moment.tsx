import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, View } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { AddProductSheet } from "@/components/moment/AddProductSheet";
import { CreatorToolSheets, type CreatorToolKind } from "@/components/moment/CreatorToolSheets";
import { ChooseMoment } from "@/components/moment/ChooseMoment";
import { MomentIntake } from "@/components/moment/MomentIntake";
import { MomentUploadedReview } from "@/components/moment/MomentUploadedReview";
import { MomentCamera } from "@/components/moment/MomentCamera";
import { MomentComplete } from "@/components/moment/MomentComplete";
import { MomentShareScreen } from "@/components/moment/MomentShareScreen";
import { MomentStoryPreview } from "@/components/moment/MomentStoryPreview";
import { RenderJobWebView } from "@/components/moment/RenderJobWebView";
import { needsUnmaskRender } from "@/lib/moment/render/needsRender";
import { registerNativeRenderMount } from "@/lib/moment/render/nativeRenderBus";
import { renderUnmaskMedia } from "@/lib/moment/render/renderUnmask";
import { hapticSaved } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import {
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

export default function Moment() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trend?: string }>();
  const uid = useAppStore((s) => s.profile?.id);
  const display = useAppStore((s) => s.profile?.displayName) || "You";
  const add = useLocalMoments((s) => s.add);

  const storageKey = uid ? `unmask:moment-batch:${uid}` : "unmask:moment-batch:guest";
  const { value: draft, setValue: setDraft, ready, clear } = useTrackingDraft<MomentBatchDraft>(storageKey, initialMomentBatchDraft());
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [reviewProcessing, setReviewProcessing] = useState(false);
  const [studioTool, setStudioTool] = useState<CreatorToolKind>(null);
  const [nativeRenderJobId, setNativeRenderJobId] = useState<string | null>(null);
  const renderToken = useRef(0);

  useEffect(() => {
    registerNativeRenderMount((jobId) => setNativeRenderJobId(jobId));
    return () => registerNativeRenderMount(null);
  }, []);

  const healedDraft = useRef(false);

  useEffect(() => {
    if (!ready || healedDraft.current) return;
    setDraft((d) => {
      const needsHeal =
        !d.creator ||
        !Array.isArray(d.mediaAssets) ||
        typeof d.caption !== "string" ||
        (d.step !== "choose" && !d.kind) ||
        (["setup", "preview", "share"].includes(d.step) && !d.mediaUri);
      if (!needsHeal) {
        healedDraft.current = true;
        return d;
      }
      healedDraft.current = true;
      return normalizeMomentBatchDraft(d);
    });
  }, [ready, setDraft]);

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
        step: "intake",
        creator: {
          backgroundId: "original",
          captureSpeed: 1,
          soundId: t.soundId,
          lookId: t.lookId,
        },
        context: t.momentKind === "grwm" ? { occasion: "Date Night" } : {},
      }),
    );
  }, [ready, params.trend, draft.step, draft.kind, setDraft]);

  const patch = useCallback(
    (part: Partial<MomentBatchDraft>) => setDraft((d) => normalizeMomentBatchDraft({ ...d, ...part })),
    [setDraft],
  );

  const renderFingerprint = useMemo(
    () =>
      JSON.stringify({
        media: draft.originalMediaUri ?? draft.mediaUri,
        mediaKind: draft.mediaKind,
        creator: draft.creator,
        audioBehavior: draft.audioBehavior,
        context: draft.context,
        kind: draft.kind,
        brand: draft.step === "share",
      }),
    [draft.originalMediaUri, draft.mediaUri, draft.mediaKind, draft.creator, draft.audioBehavior, draft.context, draft.kind, draft.step],
  );

  const runRender = useCallback(async (opts?: { burnBranding?: boolean }) => {
    const snapshot = draft;
    if (!snapshot.mediaUri) return snapshot.mediaUri;
    const burnBranding = opts?.burnBranding ?? snapshot.step === "share";
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
      renderLabel: burnBranding ? "Adding Unmask mark…" : "Removing background…",
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
      const msg = e instanceof Error ? e.message : "Background processing timed out";
      // Soft-fail: keep original media so publish still works
      patch({
        renderStatus: "error",
        renderError: msg.includes("timeout")
          ? "Background removal took too long on this device. You can retry or publish with the original background."
          : "Couldn’t finish background removal. Retry or publish without it.",
        renderedMediaUri: undefined,
        renderProgress: 0,
      });
      return snapshot.mediaUri;
    }
  }, [draft, patch]);

  useEffect(() => {
    if (!ready) return;
    if (draft.step !== "preview" && draft.step !== "share") return;
    if (draft.renderStatus === "processing") return;
    if (draft.renderStatus === "ready" && draft.renderedMediaUri) return;
    if (draft.renderStatus === "error") return;
    void runRender().catch(() => undefined);
  }, [ready, draft.step, renderFingerprint, runRender, draft.renderStatus, draft.renderedMediaUri]);

  const lastRenderFingerprint = useRef(renderFingerprint);
  useEffect(() => {
    if (lastRenderFingerprint.current === renderFingerprint) return;
    lastRenderFingerprint.current = renderFingerprint;
    if (draft.renderedMediaUri) {
      patch({ renderStatus: "idle", renderedMediaUri: undefined, renderError: "" });
    }
  }, [renderFingerprint, draft.renderedMediaUri, patch]);

  const applyTrend = useCallback(
    (trendId: string) => {
      const t = SAMPLE_TRENDS.find((x) => x.id === trendId);
      if (!t) return;
      patch({
        trendId: t.id,
        kind: t.momentKind,
        step: "intake",
        creator: {
          backgroundId: "original",
          captureSpeed: 1,
          soundId: t.soundId,
          lookId: t.lookId,
        },
        context: t.momentKind === "grwm" ? { occasion: "Date Night" } : {},
      });
    },
    [patch],
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
        step: source === "device_upload" ? "review" : "setup",
      });
    },
    [patch],
  );

  const recordCapture = useCallback(
    (uri: string, mk: "photo" | "video", multi: boolean) => {
      const asset: MomentMediaAsset = { id: `cap-${Date.now()}`, uri, kind: mk, source: "camera" };
      if (multi) {
        setDraft((d) =>
          normalizeMomentBatchDraft({
            ...d,
            mediaAssets: [...(d.mediaAssets ?? []), asset],
            mediaUri: d.mediaUri || uri,
            originalMediaUri: d.originalMediaUri || uri,
            mediaKind: mk,
          }),
        );
        return;
      }
      ingestMedia(asset, mk, "camera");
    },
    [ingestMedia, patch, setDraft],
  );

  const uploadFromDevice = useCallback(async () => {
    if (!draft.kind) return;
    setImportError("");
    setImporting(true);
    try {
      const videoFirst = momentConfig(draft.kind).videoFirst ?? false;
      const result = await pickDeviceMomentMedia({ videoFirst });
      if (!result.ok) {
        if (result.reason !== "cancelled" && result.message) setImportError(result.message);
        return;
      }
      setReviewProcessing(true);
      const asset = { ...result.asset };
      if (asset.kind === "video" && Platform.OS !== "web") {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0 });
          asset.posterUri = thumb.uri;
        } catch {
          /* poster optional */
        }
      }
      // Avoid persisting giant binary into AsyncStorage — keep blob:/file uri for this session
      ingestMedia(asset, result.mediaKind, "device_upload");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Upload failed. Try a shorter MP4.");
    } finally {
      setImporting(false);
      setReviewProcessing(false);
    }
  }, [draft.kind, ingestMedia]);

  const setContext = useCallback(
    (context: MomentContext) => setDraft((d) => ({ ...d, context })),
    [setDraft],
  );

  const attachProduct = useCallback(
    (p: MomentAttachedProduct) => {
      setDraft((d) => {
        const list = d.context.products ?? [];
        if (list.some((x) => x.productId === p.productId)) return d;
        const products = [...list, p];
        return {
          ...d,
          context: {
            ...d.context,
            products,
            productName: d.context.productName || p.name,
            productImage: d.context.productImage || p.image,
            timelineId: d.context.timelineId || p.journeyId,
            timelineLabel: d.context.timelineLabel || (p.journeyId ? `${p.name} · Your timeline` : undefined),
          },
        };
      });
    },
    [setDraft],
  );

  const resetFlow = useCallback(() => {
    void clear();
    setDraft(initialMomentBatchDraft());
    setPublishError("");
  }, [clear, setDraft]);

  const pickKind = (k: MomentKind) => {
    // Guests can still craft a draft locally; publish remains the auth gate.
    const keepMedia = draft.kind === k && draftHasMedia(draft);
    patch({
      draftId: keepMedia ? draft.draftId : `draft-${Date.now()}`,
      kind: k,
      step: "intake",
      ...(keepMedia
        ? {}
        : {
            mediaUri: "",
            mediaAssets: [],
            originalMediaUri: undefined,
            coverTimeMs: undefined,
            coverPosterUri: undefined,
            mediaSource: "camera" as const,
          }),
      context: k === "grwm" ? { ...(keepMedia ? draft.context : {}), occasion: draft.context.occasion || "Date Night" } : keepMedia ? draft.context : {},
    });
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
      let publishUri = draft.renderedMediaUri ?? draft.mediaUri;
      // Prefer branded bake for publish; never block forever — fall back to original
      if (draft.renderStatus === "error" || !draft.renderedMediaUri) {
        try {
          publishUri = (await runRender({ burnBranding: true })) || draft.mediaUri;
        } catch {
          publishUri = draft.mediaUri;
        }
      }
      publishUri = pickPersistableMediaUri(publishUri, draft.originalMediaUri || draft.mediaUri);

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
          /* offline or logged out */
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
          /* journey optional */
        }
      }

      const config = momentConfig(kind);
      const occasion = displayOccasion(context);
      const caption =
        (draft.caption ?? "").trim() ||
        context.experience?.trim() ||
        [config.title, occasion, context.productName].filter(Boolean).join(" · ") ||
        config.tagline;

      add({
        photo: publishUri,
        caption,
        author: display,
        productName: context.productName,
        productIds: products.map((p) => p.productId),
        timelineId: context.timelineId,
        timelineLabel: context.timelineLabel,
        destination: "story",
        mediaKind: draft.mediaKind,
        momentKind: kind,
        occasion,
        usageDuration: context.usageDuration,
        routineTags: context.routineTags,
        audience,
        saveToJourney,
        stickers: [`${config.title} ${config.emoji}`, occasion].filter(Boolean) as string[],
        trendId: draft.trendId,
        mediaSource: draft.mediaSource,
        coverPosterUri: pickPersistableMediaUri(draft.coverPosterUri, publishUri),
        soundUri: resolveStudioSoundUri(draft.creator) || undefined,
        soundMaxMs:
          draft.mediaKind === "photo"
            ? Math.min(UNMASK_IMAGE_BGM_MAX_SEC, selectedSoundDurationSec(draft.creator) ?? UNMASK_IMAGE_BGM_MAX_SEC) * 1000
            : undefined,
        slideCaptions: draft.mediaAssets.map((a) => a.caption || "").filter(Boolean),
      });
      hapticSaved("moment");
      try {
        await clear();
      } catch {
        /* storage clear optional */
      }
      setDraft(initialMomentBatchDraft());
      router.replace("/community" as Href);
    } catch (e) {
      const detail = e instanceof Error && e.name === "QuotaExceededError"
        ? "Storage is full — try a smaller photo or clear old drafts."
        : "Publish didn’t finish. Your draft is still here — tap Publish to retry.";
      setPublishError(detail);
    } finally {
      setPublishing(false);
    }
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: "#FFF1ED" }} />;

  const previewUri =
    draft.renderStatus === "ready" && draft.renderedMediaUri ? draft.renderedMediaUri : draft.mediaUri;

  if (draft.step === "choose") {
    return (
      <ChooseMoment
        onPick={pickKind}
        onStartCamera={() => pickKind("grwm")}
        onJoinTrend={applyTrend}
        onBack={() => router.back()}
        onProductStory={() => {
          if (!uid) {
            router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/contribute" } } as Href);
            return;
          }
          router.push("/contribute" as Href);
        }}
      />
    );
  }

  if (draft.step === "intake" && draft.kind) {
    const canContinue = draftHasMedia(draft);
    return (
      <MomentIntake
        kind={draft.kind}
        hasExistingDraft={canContinue}
        importing={importing}
        importError={importError}
        onBack={() => patch({ step: "choose", kind: null })}
        onRecord={() => patch({ step: "camera", mediaSource: "camera" })}
        onUpload={() => void uploadFromDevice()}
        onContinueDraft={() => patch({ step: draft.mediaSource === "device_upload" ? "review" : "setup" })}
      />
    );
  }

  if (draft.step === "review" && draft.kind && draft.mediaUri) {
    const asset = draft.mediaAssets[0] ?? { id: "primary", uri: draft.mediaUri, kind: draft.mediaKind, source: draft.mediaSource };
    return (
      <MomentUploadedReview
        asset={{ ...asset, uri: draft.mediaUri, kind: draft.mediaKind }}
        processing={reviewProcessing}
        error={importError || undefined}
        onBack={() => patch({ step: "intake" })}
        onRemove={() => patch({ mediaUri: "", mediaAssets: [], originalMediaUri: undefined, coverPosterUri: undefined, step: "intake" })}
        onReselect={() => void uploadFromDevice()}
        onCover={(coverPosterUri, coverTimeMs) => patch({ coverPosterUri, coverTimeMs })}
        onContinue={() => patch({ step: "setup" })}
      />
    );
  }

  if (draft.step === "camera" && draft.kind) {
    return (
      <View style={{ flex: 1 }}>
        <MomentCamera
          kind={draft.kind}
          creator={draft.creator}
          onCreatorChange={(creator) => patch({ creator })}
          lastThumb={draft.mediaAssets?.at(-1)?.uri ?? draft.mediaUri}
          onClose={() => {
            if (draft.mediaUri) patch({ step: "setup" });
            else confirmDiscard(() => {
              patch({ step: "intake" });
            });
          }}
          onAddProduct={() => patch({ productSheetOpen: true })}
          onShot={(uri, mk, multi) => recordCapture(uri, mk, multi)}
          onPickDevice={() => void uploadFromDevice()}
          onContinueMulti={() => {
            if (draft.mediaUri) patch({ step: "setup" });
          }}
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

  if (draft.step === "setup" && draft.kind && draft.mediaUri) {
    return (
      <>
        <MomentComplete
          kind={draft.kind}
          mediaUri={draft.mediaUri}
          mediaKind={draft.mediaKind}
          mediaAssets={draft.mediaAssets}
          mediaSource={draft.mediaSource}
          onRemoveMedia={() => {
            patch({ mediaUri: "", mediaAssets: [], step: "intake" });
          }}
          onStyleTool={(tool) => setStudioTool(tool)}
          onMediaAssetsChange={(mediaAssets) => {
            const primary = mediaAssets[0];
            patch({
              mediaAssets,
              mediaUri: primary?.uri ?? "",
              mediaKind: primary?.kind ?? draft.mediaKind,
            });
          }}
          onAddSlide={() => {
            void (async () => {
              const result = await pickDeviceMomentMedia({ videoFirst: false });
              if (!result.ok) return;
              const mediaAssets = [...(draft.mediaAssets.length ? draft.mediaAssets : [{ id: "primary", uri: draft.mediaUri, kind: draft.mediaKind }]), result.asset];
              patch({ mediaAssets, mediaUri: mediaAssets[0].uri, mediaKind: mediaAssets[0].kind });
            })();
          }}
          context={draft.context}
          onContextChange={setContext}
          productSheetOpen={draft.productSheetOpen}
          onProductSheetOpenChange={(open) => patch({ productSheetOpen: open })}
          onAttachProduct={attachProduct}
          onDiscard={() => confirmDiscard(() => {
            resetFlow();
            router.replace("/" as Href);
          })}
          onBack={() => patch({ step: draft.mediaSource === "device_upload" ? "review" : "camera" })}
          onNext={(ctx) => {
            setContext(ctx);
            patch({ productSheetOpen: false, step: "preview" });
          }}
        />
        <CreatorToolSheets
          open={studioTool}
          creator={draft.creator}
          onClose={() => setStudioTool(null)}
          onChange={(creator) => patch({ creator })}
          mediaKind={draft.mediaKind}
          audioBehavior={draft.audioBehavior}
          onAudioBehaviorChange={(audioBehavior) => patch({ audioBehavior })}
        />
      </>
    );
  }

  if (draft.step === "preview" && draft.kind && draft.mediaUri) {
    return (
      <>
      <MomentStoryPreview
        kind={draft.kind}
        mediaUri={previewUri}
        mediaKind={draft.mediaKind}
        creator={draft.creator}
        coverPosterUri={draft.coverPosterUri}
        context={draft.context}
        processing={draft.renderStatus === "processing" || (needsUnmaskRender(draft) && draft.renderStatus !== "ready" && draft.renderStatus !== "error")}
        processingLabel={draft.renderLabel}
        processingProgress={draft.renderProgress}
        renderError={draft.renderStatus === "error" ? draft.renderError : undefined}
        baked={draft.renderStatus === "ready" && Boolean(draft.renderedMediaUri)}
        onCreatorChange={(creator) => patch({ creator, renderStatus: "idle", renderedMediaUri: undefined })}
        onRetryRender={() => {
          patch({ renderStatus: "idle", renderedMediaUri: undefined });
          void runRender();
        }}
        onBack={() => patch({ step: "setup" })}
        onNext={() => {
          if (draft.renderStatus === "processing") return;
          patch({ step: "share" });
        }}
      />
      <RenderJobWebView jobId={nativeRenderJobId} />
      </>
    );
  }

  if (draft.step === "share" && draft.kind && draft.mediaUri) {
    return (
      <>
      <MomentShareScreen
        kind={draft.kind}
        mediaUri={previewUri}
        context={draft.context}
        creator={draft.creator}
        renderHint={draft.renderStatus === "error" ? draft.renderError : draft.renderStatus === "processing" ? draft.renderLabel : undefined}
        caption={draft.caption ?? ""}
        onCaptionChange={(caption) => patch({ caption })}
        onOpenProducts={() => patch({ step: "setup", productSheetOpen: true })}
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
      <RenderJobWebView jobId={nativeRenderJobId} />
      </>
    );
  }

  return (
    <>
      <ChooseMoment
        onPick={pickKind}
        onStartCamera={() => pickKind("grwm")}
        onJoinTrend={applyTrend}
        onBack={() => router.back()}
        onProductStory={() => router.push("/contribute" as Href)}
      />
      <RenderJobWebView jobId={nativeRenderJobId} />
    </>
  );
}