import type { MomentBatchDraft } from "@/lib/moment/types";

export type RenderInput = Pick<
  MomentBatchDraft,
  "mediaUri" | "mediaKind" | "creator" | "audioBehavior" | "coverPosterUri" | "originalMediaUri" | "context" | "kind"
> & {
  /** Always burn Unmask watermark + context into share/export output. */
  burnBranding?: boolean;
};

export type RenderOutput = {
  outputUri: string;
  posterUri?: string;
  processed: boolean;
  mimeType: string;
};
