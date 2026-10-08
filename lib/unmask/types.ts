export type UnmaskTab = 'scorecard' | 'highlights' | 'videos' | 'reviews' | 'ask';

export type DimensionTone = 'positive' | 'mixed' | 'negative';

export type UnmaskDimension = {
  id: string;
  label: string;
  subtitle: string;
  score: number | null;
  tone: DimensionTone;
  takeaway: string;
  claimId?: string;
};

export type UnmaskHighlight = {
  id: string;
  kind: 'strength' | 'weakness' | 'divisive';
  label: string;
  title: string;
  score: number | null;
  body: string;
  mentionCount: number;
  dimensionId?: string;
};

export type EvidenceCluster = {
  id: string;
  title: string;
  summary: string;
  ownerCount: number;
  tone: DimensionTone;
  quotes: { text: string; origin: string }[];
  claimId: string;
};

export type DisagreementCard = {
  id: string;
  title: string;
  positive: { label: string; pct: number; count: number; quote: string };
  negative: { label: string; pct: number; count: number; quote: string };
  claimId: string;
};

export type AskSuggestion = {
  id: string;
  question: string;
  keywords: string[];
};

export type AskAnswer = {
  question: string;
  shortAnswer: string;
  buckets: { label: string; pct: number; count: number; tone: 'positive' | 'mixed' | 'negative' }[];
  findings: string[];
  evidence: { summary: string; origin: string }[];
  claimId: string;
};

export type AskResult =
  | { kind: 'answer'; answer: AskAnswer }
  | { kind: 'insufficient'; hint: string; suggestions: AskSuggestion[] };

export type UnmaskBundle = {
  overallScore: number | null;
  verdictLine: string;
  experienceCount: number;
  videoCount: number;
  discussionCount: number;
  dimensions: UnmaskDimension[];
  highlights: UnmaskHighlight[];
  clusters: EvidenceCluster[];
  disagreements: DisagreementCard[];
  uncovered: import('@/lib/claims/types').OwnerDiscovery[];
  suggestions: AskSuggestion[];
};
