import { MOMENT_SOUNDS, selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import type { CreatorSettings, MomentBatchDraft } from "@/lib/moment/types";

export type RenderReason = "branding" | "none";

type DraftSlice = Pick<MomentBatchDraft, "mediaUri"> & {
  burnBranding?: boolean;
};

/** Branding bake for share/status/export (TikTok-style Unmask mark + products). */
export function renderReasonFor(draft: DraftSlice): RenderReason {
  if (!draft.mediaUri) return "none";
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

export function displayRenderLabel(reason: RenderReason): string {
  if (reason === "branding") return "Adding Unmask mark…";
  return "Preparing Unmask…";
}

export function hasRenderedOutput(draft: MomentBatchDraft): boolean {
  return Boolean(draft.renderedMediaUri && draft.renderStatus === "ready");
}

export { selectedSoundLabel };
