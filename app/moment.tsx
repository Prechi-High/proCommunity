import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { AddProductSheet } from "@/components/moment/AddProductSheet";
import { ChooseMoment } from "@/components/moment/ChooseMoment";
import { MomentCamera } from "@/components/moment/MomentCamera";
import { MomentComplete } from "@/components/moment/MomentComplete";
import { MomentShareScreen } from "@/components/moment/MomentShareScreen";
import { MomentStoryPreview } from "@/components/moment/MomentStoryPreview";
import { hapticSaved } from "@/lib/haptics";
import * as living from "@/lib/living/api";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import {
  displayOccasion,
  initialMomentBatchDraft,
  normalizeMomentBatchDraft,
  type MomentAttachedProduct,
  type MomentBatchDraft,
  type MomentContext,
  type MomentMediaAsset,
} from "@/lib/moment/types";
import { SAMPLE_TRENDS } from "@/lib/moment/creatorCatalog";
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
  const healedDraft = useRef(false);

  useEffect(() => {
    if (!ready || healedDraft.current) return;
    healedDraft.current = true;
    setDraft((d) => normalizeMomentBatchDraft(d));
  }, [ready, setDraft]);

  const patch = useCallback(
    (part: Partial<MomentBatchDraft>) => setDraft((d) => normalizeMomentBatchDraft({ ...d, ...part })),
    [setDraft],
  );

  const applyTrend = useCallback(
    (trendId: string) => {
      const t = SAMPLE_TRENDS.find((x) => x.id === trendId);
      if (!t) return;
      patch({
        trendId: t.id,
        kind: t.momentKind,
        step: "camera",
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

  const recordCapture = useCallback(
    (uri: string, mk: "photo" | "video", multi: boolean) => {
      const asset: MomentMediaAsset = { id: `cap-${Date.now()}`, uri, kind: mk };
      if (multi) {
        setDraft((d) =>
          normalizeMomentBatchDraft({
            ...d,
            mediaAssets: [...(d.mediaAssets ?? []), asset],
            mediaUri: d.mediaUri || uri,
            mediaKind: mk,
          }),
        );
        return;
      }
      patch({ mediaUri: uri, mediaKind: mk, mediaAssets: [asset], step: "setup" });
    },
    [patch, setDraft],
  );

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
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/moment" } } as Href);
      return;
    }
    patch({
      draftId: `draft-${Date.now()}`,
      kind: k,
      step: "camera",
      mediaUri: "",
      context: k === "grwm" ? { occasion: "Date Night" } : {},
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
    const { kind, mediaUri, context, saveToJourney, audience } = draft;
    if (!kind || !mediaUri || publishing) return;
    setPublishing(true);
    setPublishError("");
    try {
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
        draft.caption.trim() ||
        context.experience?.trim() ||
        [config.title, occasion, context.productName].filter(Boolean).join(" · ") ||
        config.tagline;

      add({
        photo: mediaUri,
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
      });
      hapticSaved("moment");
      await clear();
      setDraft(initialMomentBatchDraft());
      router.replace("/community" as Href);
    } catch {
      setPublishError("Publish didn’t finish. Your draft is still here — tap Publish to retry.");
    } finally {
      setPublishing(false);
    }
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: "#FFF1ED" }} />;

  useEffect(() => {
    if (params.trend && ready && draft.step === "choose" && !draft.kind) {
      applyTrend(String(params.trend));
    }
  }, [params.trend, ready, draft.step, draft.kind, applyTrend]);

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
              resetFlow();
              router.replace("/" as Href);
            });
          }}
          onAddProduct={() => patch({ productSheetOpen: true })}
          onShot={(uri, mk, multi) => recordCapture(uri, mk, multi)}
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
          onRemoveMedia={() => {
            patch({ mediaUri: "", mediaAssets: [], step: "camera" });
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
          onBack={() => patch({ step: "camera" })}
          onNext={(ctx) => {
            setContext(ctx);
            patch({ productSheetOpen: false, step: "preview" });
          }}
        />
      </>
    );
  }

  if (draft.step === "preview" && draft.kind && draft.mediaUri) {
    return (
      <MomentStoryPreview
        kind={draft.kind}
        mediaUri={draft.mediaUri}
        mediaKind={draft.mediaKind}
        context={draft.context}
        onBack={() => patch({ step: "setup" })}
        onNext={() => patch({ step: "share" })}
      />
    );
  }

  if (draft.step === "share" && draft.kind && draft.mediaUri) {
    return (
      <MomentShareScreen
        kind={draft.kind}
        mediaUri={draft.mediaUri}
        context={draft.context}
        caption={draft.caption ?? ""}
        onCaptionChange={(caption) => patch({ caption })}
        onOpenProducts={() => patch({ step: "setup", productSheetOpen: true })}
        onBack={() => patch({ step: "preview" })}
        onPublish={() => void post()}
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
      onProductStory={() => router.push("/contribute" as Href)}
    />
  );
}