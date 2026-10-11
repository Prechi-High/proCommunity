export type UnmaskJobState =
  | "queued"
  | "identified"
  | "researching"
  | "mapping"
  | "scoring"
  | "ready"
  | "failed";

export type UnmaskJobProgress = {
  state: UnmaskJobState;
  progressPercent: number;
  completedStages: string[];
  activeStages: string[];
  providerCounts?: Record<string, number>;
  sections?: Partial<Record<"details" | "evidence" | "videos" | "scores", "ready" | "researching" | "pending">>;
  parallelStages?: string[];
  startedAt: string;
  updatedAt: string;
};

export type UnmaskJobTimings = {
  previewIdentityMs?: number;
  imageMs?: number;
  blueprintMs?: number;
  youtubeMs?: number;
  redditMs?: number;
  webMs?: number;
  evidenceMappingMs?: number;
  scoringMs?: number;
  totalReadyMs?: number;
};

export type ProductPreviewPayload = {
  id: string;
  query: string;
  identity: {
    name: string;
    brand: string;
    manufacturer?: string;
    model: string;
    category: string;
    subcategory?: string;
    variant?: string;
    size?: string;
  };
  domain?: string;
  summary?: string;
  heroImageUrl: string | null;
  images: string[];
  gallery?: Array<{ url: string; title?: string }>;
  specs?: Array<{ label: string; value: string }>;
};

export type UnmaskJobRecord = {
  productId: string;
  progress: UnmaskJobProgress;
  timings?: UnmaskJobTimings;
  error?: string;
};
