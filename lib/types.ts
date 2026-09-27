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
  sources: EvidenceSource[];
  verifiedAt: string;
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
