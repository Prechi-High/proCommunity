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

export type MomentMediaAsset = {
  id: string;
  uri: string;
  kind: "photo" | "video";
  durationMs?: number;
};

export type CreatorSettings = {
  soundId?: string;
  localSoundUri?: string;
  localSoundName?: string;
  lookId?: string;
  backgroundId?: string;
  localBackgroundUri?: string;
  lightingId?: string;
  beautyEnabled?: boolean;
  effectId?: string;
  timerSec?: number;
  gridEnabled?: boolean;
  captureSpeed?: 0.5 | 1 | 2;
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
  eveningSteps?: string;
  experience?: string;
  skinType?: string;
  skinGoal?: string;
  moodLook?: string;
  taggedPeople?: string[];
};

export type MomentAudience = "everyone" | "followers" | "private";

export type MomentFlowStep = "choose" | "camera" | "setup" | "preview" | "share";

export type MomentBatchDraft = {
  draftId: string;
  step: MomentFlowStep;
  kind: MomentKind | null;
  mediaUri: string;
  /** Raw capture kept for reverting background/look processing. */
  originalMediaUri?: string;
  mediaKind: "photo" | "video";
  mediaAssets: MomentMediaAsset[];
  context: MomentContext;
  audience: MomentAudience;
  saveToJourney: boolean;
  productSheetOpen: boolean;
  creator: CreatorSettings;
  caption: string;
  trendId?: string;
};

export function initialMomentBatchDraft(): MomentBatchDraft {
  return {
    draftId: `draft-${Date.now()}`,
    step: "choose",
    kind: null,
    mediaUri: "",
    mediaKind: "photo",
    mediaAssets: [],
    context: {},
    audience: "everyone",
    saveToJourney: true,
    productSheetOpen: false,
    creator: { backgroundId: "original", captureSpeed: 1 },
    caption: "",
  };
}

/** Heal AsyncStorage drafts from older app versions so the flow never crashes mid-step. */
const CREATOR_DEFAULT: CreatorSettings = { backgroundId: "original", captureSpeed: 1 };

export function normalizeMomentBatchDraft(raw: Partial<MomentBatchDraft> & { step?: MomentFlowStep }): MomentBatchDraft {
  const merged: MomentBatchDraft = {
    draftId: raw.draftId ?? `draft-${Date.now()}`,
    step: raw.step ?? "choose",
    kind: raw.kind ?? null,
    mediaUri: raw.mediaUri ?? "",
    mediaKind: raw.mediaKind ?? "photo",
    mediaAssets: Array.isArray(raw.mediaAssets) ? raw.mediaAssets : [],
    context: raw.context ?? {},
    audience: raw.audience ?? "everyone",
    saveToJourney: raw.saveToJourney ?? true,
    productSheetOpen: raw.productSheetOpen ?? false,
    creator: { ...CREATOR_DEFAULT, ...(raw.creator ?? {}) },
    caption: typeof raw.caption === "string" ? raw.caption : "",
    trendId: raw.trendId,
  };

  if (merged.step !== "choose" && !merged.kind) merged.step = "choose";
  if (["setup", "preview", "share"].includes(merged.step) && !merged.mediaUri) {
    merged.step = merged.kind ? "camera" : "choose";
  }
  if (merged.step === "camera" && !merged.kind) merged.step = "choose";
  return merged;
}

export function displayOccasion(ctx: MomentContext): string | undefined {
  if (ctx.occasion === "My Own" && ctx.customOccasion?.trim()) return ctx.customOccasion.trim();
  return ctx.occasion;
}

export function productCount(ctx: MomentContext): number {
  return ctx.products?.length ?? (ctx.productName ? 1 : 0);
}