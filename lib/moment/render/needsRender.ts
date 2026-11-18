import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import { MOMENT_SOUNDS, selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import type { CreatorSettings, MomentAudioBehavior, MomentBatchDraft } from "@/lib/moment/types";

export type RenderReason = "background" | "audio" | "look" | "branding" | "none";

type DraftSlice = Pick<MomentBatchDraft, "mediaUri" | "mediaKind" | "creator" | "audioBehavior"> & {
  /** Explicit share/export bake — burns Unmask watermark + context. */
  burnBranding?: boolean;
};

export function renderReasonFor(draft: DraftSlice): RenderReason {
  if (!draft.mediaUri) return "none";
  const layers = resolvePreviewLayers(draft.creator);
  if (layers.backgroundMode !== "original") return "background";
  if (layers.lookOpacity > 0 || layers.lightOpacity > 0) return "look";
  if (shouldMuxAudio(draft.mediaKind, draft.audioBehavior, draft.creator)) return "audio";
  if (draft.burnBranding) return "branding";
  return "none";
}

export function needsUnmaskRender(draft: DraftSlice): boolean {
  return renderReasonFor(draft) !== "none";
}

export function resolveMusicUri(creator: CreatorSettings): string | null {
  if (creator.localSoundUri) return creator.localSoundUri;
  if (!creator.soundId) return null;
  const track = MOMENT_SOUNDS.find((s) => s.id === creator.soundId);
  return track?.previewUri ?? null;
}

export function shouldMuxAudio(
  mediaKind: "photo" | "video",
  audioBehavior: MomentAudioBehavior | undefined,
  creator: CreatorSettings,
): boolean {
  if (mediaKind !== "video") return false;
  if (!resolveMusicUri(creator)) return false;
  const behavior = audioBehavior ?? "keep_original";
  return behavior === "replace" || behavior === "mix";
}

export function displayRenderLabel(reason: RenderReason): string {
  if (reason === "background") return "Replacing background…";
  if (reason === "audio") return "Mixing audio…";
  if (reason === "branding") return "Adding Unmask mark…";
  return "Preparing Unmask…";
}

export function hasRenderedOutput(draft: MomentBatchDraft): boolean {
  return Boolean(draft.renderedMediaUri && draft.renderStatus === "ready");
}

export { selectedSoundLabel };
