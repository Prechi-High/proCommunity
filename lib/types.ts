export type PostType = 'question' | 'answer' | 'experience' | 'update' | 'feed_post';

export type PostStatus = 'visible' | 'flagged' | 'removed';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  onboardingComplete: boolean;
  isAdmin?: boolean;
}

export interface Price {
  amount: number;
  currency: string;
  display: string;
}

/** Identity-level product record: enough to list, save and open a product anywhere. */
export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description?: string;
  heroImageUrl?: string | null;
  price?: Price | null;
  rating?: number | null;
  ratingCount?: number | null;
  offers?: number;
  source?: string | null;
  productUrl?: string | null;
}

export interface Cited {
  text: string;
  source: number | null;
}

export interface SpecRow {
  label: string;
  value: string;
  source: number | null;
}

export interface Offer {
  seller: string;
  price: Price | null;
  link: string | null;
  rating: number | null;
}

export interface EvidenceSource {
  n: number;
  title: string;
  url: string;
  domain: string;
  kind: 'web' | 'review' | 'community' | string;
}

export type VoicePlatform = 'youtube' | 'reddit' | 'review' | 'forum';
export type Stance = 'love' | 'mixed' | 'warn';

/** A real person's words about a product, kept verbatim with where they said it. */
export interface Voice {
  id: string;
  /** C1 / S2 style ref from investigate LLM — used to attach owner themes to comments. */
  evidenceRef?: string;
  platform: VoicePlatform;
  author: string;
  avatar: string | null;
  text: string;
  mark: string;
  stance: Stance;
  topic: string;
  likes: number;
  url: string;
  where: string;
  date: string;
}

export interface Reveal {
  text: string;
  mark: string;
  voiceIds: string[];
}

/** Intelligence-level profile produced by the `product-intelligence` edge function. */
export interface ProductProfile {
  id: string;
  query: string;
  identity: {
    name: string;
    brand: string;
    manufacturer: string;
    model: string;
    category: string;
    subcategory: string;
    variant: string;
    size: string;
  };
  summary: string;
  verdict: string;
  consensus?: string;
  consensusMark?: string;
  voices?: Voice[];
  reveals?: Reveal[];
  people?: { voices: number; commenters: number; ratings: number; discussions: number };
  specs: SpecRow[];
  praise: Cited[];
  complaints: Cited[];
  bestFor: string[];
  notFor: string[];
  uses: string[];
  howToUse: string;
  compatibility: string;
  alternatives: { name: string; reason: string }[];
  offers: Offer[];
  priceRange: { min: number; max: number; currency: string; count: number } | null;
  rating: number | null;
  ratingCount: number | null;
  score: number | null;
  confidence: number;
  band: 'High' | 'Likely' | 'Uncertain';
  images: string[];
  gallery?: GalleryImage[];
  variants?: ProductVariant[];
  sources: EvidenceSource[];
  verifiedAt: string;
  /** Claim agreement scores & owner discoveries (policy v1). */
  findings?: import('./claims/types').ProductFindings;
  identityConfidence?: number;
  /** Backend presentation contract (dynamic navigation, facts, dimensions). */
  presentation?: import('./unmask/presentation').ProductPresentation;
}

export interface GalleryImage {
  url: string;
  title: string;
  source: string;
  width?: number | null;
  height?: number | null;
}

export interface ProductVariant {
  label: string;
  kind: string;
  query: string;
}

export interface VisualMatch {
  title: string;
  source: string;
  link: string;
  image: string;
  exact: boolean;
}

/** What the camera found, kept so the product page can show the photo and let people correct the match. */
export interface ScanRecord {
  photo: string;
  label: string;
  confidence: number;
  features: string[];
  alternatives: string[];
  matches: VisualMatch[];
  at: string;
}

export type ThreadKind = 'question' | 'worry' | 'experience' | 'compare' | 'tip' | 'review';

export interface CommunityReply {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string;
  is_owner: boolean;
  /** Set only when the author verified owning this exact product with a live photo. */
  owner_product_id?: string | null;
  owner_product_name?: string | null;
  owner_product_image?: string | null;
  body: string;
  helpful: number;
  created_at: string;
}

/** Shared, server-backed conversation about a product (or a pair of products). */
export interface CommunityThread {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  category: string | null;
  kind: ThreadKind;
  title: string;
  body: string | null;
  compare_id: string | null;
  compare_name: string | null;
  compare_image: string | null;
  author_id: string;
  author_name: string;
  reply_count: number;
  created_at: string;
  last_activity_at: string;
  image_url?: string | null;
  rating?: number | null;
  votes?: number;
  follower_count?: number;
  brand?: string | null;
  voted?: boolean;
  following?: boolean;
  is_owner?: boolean;
  owner_product_id?: string | null;
  owner_product_name?: string | null;
  owner_product_image?: string | null;
  community_replies?: CommunityReply[];
}

export interface CommunityNotification {
  id: string;
  thread_id: string;
  actor_name: string;
  kind: 'reply' | 'owner_reply' | 'vote';
  snippet: string | null;
  thread_title: string | null;
  product_name: string | null;
  read: boolean;
  created_at: string;
}

export type OwnershipMilestone = 'first_note' | 'one_week' | 'one_month' | 'three_months' | 'six_months' | 'one_year' | 'after_problem' | 'update';

/** A verified owner telling Sourced what living with the product is actually like. */
export interface OwnershipNote {
  id: string;
  user_id: string;
  author_name: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  brand: string | null;
  category: string | null;
  verification_id?: string | null;
  milestone: OwnershipMilestone;
  title: string;
  body: string;
  used_for: string | null;
  used_duration: string | null;
  times_bought: number | null;
  rating: number | null;
  would_rebuy: boolean | null;
  time_to_problem: string | null;
  time_to_results: string | null;
  positive_tags: string[];
  issue_tags: string[];
  context_tags: string[];
  helpful: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRoom {
  posts: number;
  byKind: Partial<Record<ThreadKind, number>>;
  replies: number;
  followers: number;
  memberRating: number | null;
  ratedBy: number;
  views30d: number;
  viewsThisWeek: number;
  compares30d: number;
  verifiedOwners?: number;
  owners?: { id: string; name: string }[];
  ownershipNotes?: number;
  notes?: OwnershipNote[];
  score: number | null;
  consensus: string | null;
  praise: string[];
  complaints: string[];
}

export interface WebVoice extends Voice {
  product_id: string;
  product_name: string;
  product_image: string | null;
  category: string;
  score: number | null;
}

export interface AskCite {
  id: string;
  author: string;
  avatar: string | null;
  platform: string;
  text: string;
  product: string;
  url: string | null;
}

export type AskHighlightTone = 'hint' | 'good' | 'bad';

export interface AskHighlight {
  text: string;
  tone: AskHighlightTone;
}

export interface AskAnswer {
  answer: string;
  mark: string;
  highlights?: AskHighlight[];
  cites: AskCite[];
  enough: boolean;
  basedOn: number;
  followups: string[];
}

export interface TrendingProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  views: number;
  asks: number;
  threads: number;
  compares: number;
  heat: number;
}

export interface Pulse {
  trending: TrendingProduct[];
  asks: { product_id: string; product_name: string | null; compare_id: string | null; question: string; answered: boolean; created_at: string }[];
  threads: CommunityThread[];
  voices?: WebVoice[];
  notes?: OwnershipNote[];
  stats: { productsResearched: number; actionsThisWeek: number; questionsAsked: number };
}

export interface CommunityPost {
  id: string;
  productId: string;
  threadId?: string | null;
  userId: string;
  authorName: string;
  parentPostId: string | null;
  type: PostType;
  body: string;
  photoUrl?: string | null;
  traitTags: string[];
  isVerifiedOwner: boolean;
  helpfulCount: number;
  status: PostStatus;
  createdAt: string;
}

export interface DiscussionThread {
  id: string;
  productId: string;
  title: string;
  createdBy: string;
  createdAt: string;
}

export interface YoutubeComment {
  id: string;
  productId: string;
  youtubeVideoId: string;
  authorDisplayName: string;
  body: string;
  fetchedAt: string;
  parentId?: string | null;
  likeCount?: number;
  replies?: YoutubeComment[];
}

export interface SeedAuthor {
  id: string;
  displayName: string;
  memberSince: string;
  verified: boolean;
  knownFor: { tag: string; answers: number }[];
  avatarUrl?: string | null;
}

export interface Ownership {
  productId: string;
  markedPurchasedAt: string;
  eligibleToPostAt: string;
}

export interface Favorite {
  productId: string;
  priceAlertEnabled: boolean;
}

export interface AppNotification {
  id: string;
  type: 'price_drop' | 'question_match' | 'check_in';
  title: string;
  body: string;
  productId?: string;
  createdAt: string;
  readAt: string | null;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  at: string;
}

export type { ContentTagKey as VideoJourneyTag } from './taxonomy';
