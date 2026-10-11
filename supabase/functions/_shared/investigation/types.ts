export type UnmaskJobState =
  | "queued"
  | "identified"
  | "researching"
  | "mapping"
  | "scoring"
  | "ready"
  | "failed";

export type UnmaskJobMilestones = {
  identified?: boolean;
  videosFound?: number;
  rawComments?: number;
  validEvidence?: number;
  youtubeComplete?: boolean;
  evidenceMappingComplete?: boolean;
  scorecardComplete?: boolean;
  blueprintStartedAt?: string;
  youtubeStartedAt?: string;
  evidenceMappingStartedAt?: string;
};

export type UnmaskJobProgress = {
  state: UnmaskJobState;
  progressPercent: number;
  completedStages: string[];
  activeStages: string[];
  providerCounts?: Record<string, number>;
  milestones?: UnmaskJobMilestones;
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
  canonicalDisplayName: string;
  variantDisplay: string;
  rawListingTitle: string;
  identificationState: import("./canonicalDisplay.ts").IdentificationState;
  domain?: string;
  summary?: string;
  heroImageUrl: string | null;
  images: string[];
  gallery?: Array<{ url: string; title?: string }>;
  specs?: Array<{ label: string; value: string }>;
  previewSource?: "redis" | "product_intel" | "candidate" | "serper";
};

export type UnmaskJobRecord = {
  productId: string;
  progress: UnmaskJobProgress;
  timings?: UnmaskJobTimings;
  error?: string;
};
