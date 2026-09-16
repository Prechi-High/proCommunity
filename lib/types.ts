export type SkinType = 'dry' | 'oily' | 'combination' | 'sensitive' | 'normal' | 'unknown';

export type SkinTypeSource = 'self_selected' | 'quiz_estimated';

export type Concern =
  | 'acne'
  | 'aging'
  | 'hyperpigmentation'
  | 'sensitivity'
  | 'dryness'
  | 'oiliness'
  | 'redness';

export type ProductCategory =
  | 'cleanser'
  | 'serum'
  | 'moisturizer'
  | 'spf'
  | 'mask'
  | 'essence'
  | 'treatment';

export type PostType = 'question' | 'answer' | 'experience' | 'update';

export type PostStatus = 'visible' | 'flagged' | 'removed';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  skinType: SkinType;
  skinTypeSource: SkinTypeSource | null;
  concerns: Concern[];
  onboardingComplete: boolean;
  isAdmin?: boolean;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  category: ProductCategory;
  ingredients: string[];
  attributeTags: string[];
  suitsSkinTypes: SkinType[];
  heroEmoji: string;
  typicalDurationDays: number | null;
  shelfLifeMonths: number | null;
  source: 'seed' | 'shopify' | 'open_beauty_facts';
  heroImageUrl?: string | null;
  barcode?: string | null;
  productUrl?: string | null;
}

export interface Listing {
  id: string;
  productId: string;
  merchantName: string;
  price: number;
  currency: 'NGN';
  inStock: boolean;
  productUrl: string;
  shipsNote: string;
  optedOut: boolean;
}

export interface LiteracyEntry {
  attributeTag: string;
  title: string;
  body: string;
  sourceNote: string;
}

export interface CommunityPost {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  parentPostId: string | null;
  type: PostType;
  body: string;
  traitTags: string[];
  isVerifiedOwner: boolean;
  helpfulCount: number;
  status: PostStatus;
  createdAt: string;
}

export interface SeedAuthor {
  id: string;
  displayName: string;
  skinType: SkinType;
  memberSince: string;
  verified: boolean;
  knownFor: { tag: string; answers: number }[];
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

export interface RoutineStep {
  id: string;
  productId: string;
  timeOfDay: 'am' | 'pm';
  stepOrder: number;
}

export interface RoutineLog {
  date: string;
  timeOfDay: 'am' | 'pm';
  completedStepIds: string[];
}

export interface ProgressEntry {
  id: string;
  productId: string;
  note: string;
  entryDate: string;
  weekLabel: string;
  isShared: boolean;
}

export interface UsageEstimate {
  productId: string;
  startedAt: string;
  estimatedEmptyDate: string | null;
  expiryDate: string | null;
}

export interface AppNotification {
  id: string;
  type: 'refill' | 'expiry' | 'price_drop' | 'question_match' | 'check_in';
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

export interface QuizAnswers {
  [questionId: string]: string;
}
