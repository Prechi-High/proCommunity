import type { MomentKind } from "./kinds";

export type MomentAttachedProduct = {
  productId: string;
  name: string;
  brand?: string;
  category?: string;
  image?: string;
  journeyId?: string;
  verificationState: "confirmed" | "pending";
};

export type MomentMediaSource = "camera" | "device_upload";

export type MomentAudioBehavior = "keep_original" | "replace" | "mix";

export type MomentMediaAsset = {
  id: string;
  uri: string;
  kind: "photo" | "video";
  durationMs?: number;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  source?: MomentMediaSource;
  posterUri?: string;
  caption?: string;
};

export type CreatorSettings = {
  soundId?: string;
  localSoundUri?: string;
  localSoundName?: string;
  /** Optional light filter id baked into export. */
  filterId?: string;
};

export type MomentContext = {
  productName?: string;
  productImage?: string;
  products?: MomentAttachedProduct[];
  timelineId?: string;
  timelineLabel?: string;
  routineTags?: string[];
  occasion?: string;
  customOccasion?: string;
  usageDuration?: string;
  usageFrequency?: string;
  eveningSteps?: string;
  experience?: string;
  confidence?: string;
  skinType?: string;
  skinGoal?: string;
  moodLook?: string;
  taggedPeople?: string[];
  location?: string;
  /** Editable headline shown on the Unmask card */
  momentTitle?: string;
};

export type MomentAudience = "everyone" | "followers" | "private";

/** Capture → Compose → Preview → Share */
export type MomentFlowStep = "choose" | "capture" | "compose" | "preview" | "share";

export type MomentBatchDraft = {
  draftId: string;
  step: MomentFlowStep;
  kind: MomentKind | null;
  productStory?: boolean;
  mediaSource: MomentMediaSource;
  mediaUri: string;
  originalMediaUri?: string;
  mediaKind: "photo" | "video";
  mediaAssets: MomentMediaAsset[];
  coverTimeMs?: number;
  coverPosterUri?: string;
  audioBehavior?: MomentAudioBehavior;
  context: MomentContext;
  audience: MomentAudience;
  saveToJourney: boolean;
  productSheetOpen: boolean;
  creator: CreatorSettings;
  caption: string;
  trendId?: string;
  renderedMediaUri?: string;
  renderStatus?: "idle" | "processing" | "ready" | "error";
  renderProgress?: number;
  renderLabel?: string;
  renderError?: string;
};

export function initialMomentBatchDraft(): MomentBatchDraft {
  return {
    draftId: `draft-${Date.now()}`,
    step: "choose",
    kind: null,
    productStory: false,
    mediaSource: "camera",
    mediaUri: "",
    mediaKind: "photo",
    mediaAssets: [],
    context: {},
    audience: "everyone",
    saveToJourney: true,
    productSheetOpen: false,
    creator: {},
    caption: "",
  };
}

const CREATOR_DEFAULT: CreatorSettings = {};

function migrateStep(step: string | undefined): MomentFlowStep {
  if (step === "share") return "share";
  if (step === "preview") return "preview";
  if (step === "compose" || step === "edit" || step === "setup") return "compose";
  if (step === "capture" || step === "camera" || step === "intake" || step === "review") return "capture";
  return "choose";
}

export function normalizeMomentBatchDraft(raw: Partial<MomentBatchDraft> & { step?: string }): MomentBatchDraft {
  const step = migrateStep(raw.step);
  const creatorRaw = (raw.creator ?? {}) as CreatorSettings & Record<string, unknown>;
  const creator: CreatorSettings = {
    soundId: typeof creatorRaw.soundId === "string" ? creatorRaw.soundId : undefined,
    localSoundUri: typeof creatorRaw.localSoundUri === "string" ? creatorRaw.localSoundUri : undefined,
    localSoundName: typeof creatorRaw.localSoundName === "string" ? creatorRaw.localSoundName : undefined,
    filterId: typeof creatorRaw.filterId === "string" ? creatorRaw.filterId : undefined,
  };

  const merged: MomentBatchDraft = {
    draftId: raw.draftId ?? `draft-${Date.now()}`,
    step,
    kind: raw.kind ?? null,
    productStory: Boolean(raw.productStory),
    mediaSource: raw.mediaSource ?? "camera",
    mediaUri: raw.mediaUri ?? "",
    originalMediaUri: raw.originalMediaUri,
    coverTimeMs: raw.coverTimeMs,
    coverPosterUri: raw.coverPosterUri,
    audioBehavior: raw.audioBehavior ?? "keep_original",
    mediaKind: raw.mediaKind ?? "photo",
    mediaAssets: Array.isArray(raw.mediaAssets) ? raw.mediaAssets : [],
    context: raw.context ?? {},
    audience: raw.audience ?? "everyone",
    saveToJourney: raw.saveToJourney ?? true,
    productSheetOpen: raw.productSheetOpen ?? false,
    creator: { ...CREATOR_DEFAULT, ...creator },
    caption: typeof raw.caption === "string" ? raw.caption : "",
    trendId: raw.trendId,
    renderedMediaUri: raw.renderedMediaUri,
    renderStatus: raw.renderStatus ?? "idle",
    renderProgress: raw.renderProgress,
    renderLabel: raw.renderLabel,
    renderError: raw.renderError,
  };

  if (merged.step !== "choose" && !merged.kind && !merged.productStory) merged.step = "choose";
  if ((merged.step === "compose" || merged.step === "preview" || merged.step === "share") && !merged.mediaUri) {
    merged.step = merged.kind || merged.productStory ? "capture" : "choose";
  }
  if (merged.step === "capture" && !merged.kind && !merged.productStory) merged.step = "choose";
  return merged;
}

export function draftHasMedia(draft: MomentBatchDraft): boolean {
  return Boolean(draft.mediaUri && draft.mediaAssets?.length);
}

export function displayOccasion(ctx: MomentContext): string | undefined {
  if (ctx.occasion === "My Own" && ctx.customOccasion?.trim()) return ctx.customOccasion.trim();
  return ctx.occasion;
}

export function productCount(ctx: MomentContext): number {
  return ctx.products?.length ?? (ctx.productName ? 1 : 0);
}

export function defaultMomentTitle(kind: MomentKind | null, productStory?: boolean, occasion?: string): string {
  if (productStory) return "My Product Story";
  if (kind === "morning") return "My Morning Routine ☀️";
  if (kind === "evening") return "My Evening Routine 🌙";
  if (kind === "grwm") return occasion ? `GRWM · ${occasion}` : "Get Ready With Me 💋";
  if (kind === "currently") return "Currently Using ✨";
  return "My Unmask Moment";
}
