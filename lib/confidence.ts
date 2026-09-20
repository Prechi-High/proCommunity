import type { CommunityPost, Product, Profile, SkinType } from './types';

export interface ConfidenceBreakdown {
  fitMatchScore: number;
  sentimentScore: number | null;
  transparencyScore: number;
  compositeScore: number | null;
  fitLabel: string;
  sentimentLabel: string;
  transparencyLabel: string;
  headline: string;
  explanation: string;
  tooFewReviews: boolean;
}

const CONCERN_TAGS: Record<string, string[]> = {
  acne: ['mattifying', 'oil_free', 'salicylic_acid', 'niacinamide'],
  oiliness: ['mattifying', 'oil_free', 'niacinamide'],
  dryness: ['hydrating', 'barrier_repair', 'ceramides'],
  aging: ['retinoid', 'peptide', 'antioxidant'],
  hyperpigmentation: ['niacinamide', 'vitamin_c', 'azelaic_acid'],
  sensitivity: ['fragrance_free', 'barrier_repair', 'gentle'],
  redness: ['fragrance_free', 'barrier_repair', 'gentle'],
};

function fitMatch(product: Product, profile: Profile | null): { score: number; label: string } {
  if (!profile || profile.skinType === 'unknown') {
    return {
      score: 55,
      label: 'Tell us your skin type for a better fit',
    };
  }

  const listed = product.suitsSkinTypes.filter((type) => type !== 'unknown');
  let score = 70;
  if (listed.length === 0) {
    score = 68;
  } else if (listed.includes(profile.skinType)) {
    score = 90;
  } else {
    score = 42;
  }

  const concernHits = profile.concerns.filter((concern) =>
    (CONCERN_TAGS[concern] ?? []).some(
      (tag) => product.attributeTags.includes(tag) || product.ingredients.includes(tag),
    ),
  ).length;
  score = Math.min(100, score + concernHits * 3);

  const label =
    score >= 80
      ? `Fits ${profile.skinType} skin`
      : score >= 60
        ? 'Partial fit for your profile'
        : `May not be an obvious fit for ${profile.skinType} skin`;

  return { score, label };
}

function sentiment(posts: CommunityPost[]): {
  score: number | null;
  label: string;
  tooFew: boolean;
  verifiedCount: number;
} {
  const visible = posts.filter((post) => post.status === 'visible');
  const lived = visible.filter(
    (post) => post.type === 'experience' || post.type === 'update' || post.type === 'answer',
  );
  const verifiedCount = visible.filter((post) => post.isVerifiedOwner).length;

  if (lived.length < 2) {
    return {
      score: null,
      label: 'Too few reviews yet',
      tooFew: true,
      verifiedCount,
    };
  }

  const helpfulTotal = lived.reduce((sum, post) => sum + post.helpfulCount, 0);
  const avgHelpful = helpfulTotal / lived.length;
  const verifiedRatio = lived.filter((post) => post.isVerifiedOwner).length / lived.length;
  const score = Math.max(
    20,
    Math.min(96, Math.round(58 + Math.min(24, avgHelpful * 1.4) + verifiedRatio * 16)),
  );

  return {
    score,
    label:
      score >= 80
        ? `${verifiedCount} verified owners reporting in`
        : score >= 60
          ? 'Mixed community feedback'
          : 'Community feedback is cautious',
    tooFew: false,
    verifiedCount,
  };
}

function transparency(product: Product): { score: number; label: string } {
  let score = 40;
  if (product.ingredients.length >= 3) score += 28;
  else if (product.ingredients.length > 0) score += 14;
  if (product.attributeTags.length >= 2) score += 16;
  if (product.attributeTags.includes('fragrance_free')) score += 8;
  if (product.description.trim().length > 40) score += 8;
  score = Math.min(100, score);

  return {
    score,
    label:
      score >= 80
        ? 'Clear ingredient labeling'
        : score >= 60
          ? 'Some ingredient detail available'
          : 'Limited ingredient transparency',
  };
}

export function scoreLabel(composite: number | null, tooFew: boolean): string {
  if (tooFew || composite == null) return 'Too few reviews yet';
  if (composite >= 80) return 'Mostly liked';
  if (composite >= 60) return 'Mixed feedback';
  return 'Cautious overall';
}

export function computeConfidence(
  product: Product,
  profile: Profile | null,
  posts: CommunityPost[],
): ConfidenceBreakdown {
  const fit = fitMatch(product, profile);
  const community = sentiment(posts);
  const claim = transparency(product);

  const compositeScore = community.score;

  const headline = scoreLabel(compositeScore, community.tooFew);
  const skin = profile?.skinType && profile.skinType !== 'unknown' ? profile.skinType : 'your';
  const explanation = community.tooFew
    ? `Product Score needs lived comments (YouTube / owners). Fit for ${skin} skin is shown separately when you open a case.`
    : `Product Score reflects what people who used it reported (${community.verifiedCount} verified owners in-app). Fit for your skin is separate.`;

  return {
    fitMatchScore: fit.score,
    sentimentScore: community.score,
    transparencyScore: claim.score,
    compositeScore,
    fitLabel: fit.label,
    sentimentLabel: community.label,
    transparencyLabel: claim.label,
    headline,
    explanation,
    tooFewReviews: community.tooFew,
  };
}

export function badgeTone(
  breakdown: ConfidenceBreakdown,
): 'sage' | 'honey' | 'neutral' {
  if (breakdown.tooFewReviews || breakdown.compositeScore == null) return 'neutral';
  if (breakdown.compositeScore >= 80) return 'sage';
  if (breakdown.compositeScore >= 60) return 'honey';
  return 'neutral';
}

export function matchesSkinFilter(product: Product, skin: SkinType | 'any'): boolean {
  if (skin === 'any') return true;
  return product.suitsSkinTypes.includes(skin);
}
