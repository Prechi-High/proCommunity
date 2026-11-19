import type { MomentBatchDraft } from "@/lib/moment/types";

export type RenderInput = Pick<
  MomentBatchDraft,
  | "mediaUri"
  | "mediaKind"
  | "creator"
  | "audioBehavior"
  | "coverPosterUri"
  | "originalMediaUri"
  | "context"
  | "kind"
  | "caption"
  | "productStory"
> & {
  /** Burn Unmask card overlays into share/export output. */
  burnBranding?: boolean;
};

export type RenderOutput = {
  outputUri: string;
  posterUri?: string;
  processed: boolean;
  mimeType: string;
};
