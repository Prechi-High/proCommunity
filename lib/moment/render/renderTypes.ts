import type { MomentBatchDraft } from "@/lib/moment/types";

export type RenderInput = Pick<
  MomentBatchDraft,
  "mediaUri" | "mediaKind" | "creator" | "audioBehavior" | "coverPosterUri" | "originalMediaUri"
>;

export type RenderOutput = {
  outputUri: string;
  posterUri?: string;
  processed: boolean;
  mimeType: string;
};