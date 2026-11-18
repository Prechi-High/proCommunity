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
};

export type MomentAudience = "everyone" | "followers" | "private";

export type MomentFlowStep = "choose" | "camera" | "setup" | "preview" | "share";

export type MomentBatchDraft = {
  draftId: string;
  step: MomentFlowStep;
  kind: MomentKind | null;
  mediaUri: string;
  mediaKind: "photo" | "video";
  context: MomentContext;
  audience: MomentAudience;
  saveToJourney: boolean;
  productSheetOpen: boolean;
};

export function initialMomentBatchDraft(): MomentBatchDraft {
  return {
    draftId: `draft-${Date.now()}`,
    step: "choose",
    kind: null,
    mediaUri: "",
    mediaKind: "photo",
    context: {},
    audience: "everyone",
    saveToJourney: true,
    productSheetOpen: false,
  };
}

export function displayOccasion(ctx: MomentContext): string | undefined {
  if (ctx.occasion === "My Own" && ctx.customOccasion?.trim()) return ctx.customOccasion.trim();
  return ctx.occasion;
}

export function productCount(ctx: MomentContext): number {
  return ctx.products?.length ?? (ctx.productName ? 1 : 0);
}