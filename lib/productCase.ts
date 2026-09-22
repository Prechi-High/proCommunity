/**
 * Product Case analysis — Product Score from people who used it
 * (YouTube comments + verified owners; Reddit later), not a skin-fit match score.
 *
 * Prefers `/api/product-case` (LLM). Falls back to extracting real comment
 * phrases + polarity heuristics when the API/LLM is unavailable.
 */

import { getProductPosts } from './catalog';
import type { CommunityPost, Product, Profile } from './types';
import { loadProductVideos, loadYoutubeComments, type LiveYoutubeComment } from './youtube';

export type CaseSource = 'yt' | 'own' | 'rd';

export interface MarkedFrag {
  /** Full display line (already short). */
  text: string;
  /** Substring inside text to highlight with the yellow marker. */
  mark: string;
  source: CaseSource;
}

export interface ClaimCluster {
  title: string;
  who: string;
  percent: number;
  tone: 'sage' | 'honey' | 'coral';
  quotes: Array<{ source: CaseSource; text: string; mark?: string }>;
}

export interface ProductCaseAnalysis {
  productId: string;
  /** 0–100 product score from lived experience. Null if too little evidence. */
  productScore: number | null;
  tooFew: boolean;
  split: { positive: number; mixed: number; negative: number };
  /** Verdict with optional **mark** segments as [[text]]. */
  verdict: string;
  verdictMarks: string[];
  frags: MarkedFrag[];
  clusters: ClaimCluster[];
  counts: { yt: number; rd: number; own: number; ig: number };
  basis: string;
  source: 'llm' | 'heuristic';
  analyzedAt: string;
}

const memory = new Map<string, { at: number; data: ProductCaseAnalysis }>();
const TTL_MS = 30 * 60 * 1000;

const POS = [
  'love',
  'loved',
  'amazing',
  'works',
  'worked',
  'helped',
  'glow',
  'clearer',
  'calmer',
  'holy grail',
  'recommend',
  'worth',
  'gentle',
  'hydrated',
  'improved',
  'no irritation',
  'less oily',
  'shine',
];
const NEG = [
  'broke me out',
  'breakout',
  'pills',
  'pilling',
  'sting',
  'stung',
  'irritat',
  'dry',
  'drying',
  'tight',
  'waste',
  'hate',
  'worst',
  'burn',
  'rash',
  'white cast',
  'greasy',
  'does nothing',
  "didn't work",
  'did not work',
];
const MIX = ['okay', 'ok', 'mixed', 'sometimes', 'maybe', 'fine but', 'not sure', 'meh'];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function polarity(text: string): 'positive' | 'mixed' | 'negative' {
  const t = text.toLowerCase();
  const pos = POS.some((w) => t.includes(w));
  const neg = NEG.some((w) => t.includes(w));
  const mix = MIX.some((w) => t.includes(w));
  if (pos && neg) return 'mixed';
  if (neg) return 'negative';
  if (pos) return 'positive';
  if (mix) return 'mixed';
  return 'mixed';
}

function pickMark(text: string): string {
  const t = text.toLowerCase();
  for (const w of [...NEG, ...POS]) {
    const i = t.indexOf(w);
    if (i >= 0) return text.slice(i, i + w.length);
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return text;
  return words.slice(0, 4).join(' ');
}

function flattenComments(threads: LiveYoutubeComment[]): string[] {
  const out: string[] = [];
  for (const c of threads) {
    if (c.body?.trim()) out.push(c.body.trim());
    for (const r of c.replies ?? []) {
      if (r.body?.trim()) out.push(r.body.trim());
    }
  }
  return out;
}

function shortLine(text: string, max = 92): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export async function gatherCaseEvidence(
  product: Product,
  userPosts: CommunityPost[] = [],
): Promise<{
  ytBodies: string[];
  ownerBodies: string[];
  counts: { yt: number; rd: number; own: number; ig: number };
}> {
  const clips = await loadProductVideos(product.name, product.brand);
  const ytBodies: string[] = [];
  for (const clip of clips.slice(0, 3)) {
    const threads = await loadYoutubeComments(clip.youtubeVideoId);
    ytBodies.push(...flattenComments(threads));
  }

  const owners = getProductPosts(product.id, userPosts).filter(
    (p) =>
      p.status === 'visible' &&
      (p.isVerifiedOwner || p.type === 'experience' || p.type === 'update' || p.type === 'answer'),
  );
  const ownerBodies = owners.map((p) => p.body.trim()).filter(Boolean);

  return {
    ytBodies,
    ownerBodies,
    counts: {
      yt: ytBodies.length,
      rd: 0,
      own: ownerBodies.length,
      ig: product.ingredients.length || 0,
    },
  };
}

function heuristicFromBodies(
  product: Product,
  ytBodies: string[],
  ownerBodies: string[],
  counts: ProductCaseAnalysis['counts'],
): ProductCaseAnalysis {
  const tagged = [
    ...ytBodies.map((text) => ({ text, source: 'yt' as const, pol: polarity(text) })),
    ...ownerBodies.map((text) => ({ text, source: 'own' as const, pol: polarity(text) })),
  ];

  const total = tagged.length;
  const tooFew = total < 5;

  if (tooFew) {
    const frags = tagged.slice(0, 6).map((row) => ({
      text: shortLine(row.text),
      mark: pickMark(shortLine(row.text)),
      source: row.source,
    }));
    while (frags.length < 3 && product.description) {
      frags.push({
        text: shortLine(product.description),
        mark: pickMark(shortLine(product.description, 40)),
        source: 'own',
      });
    }
    return {
      productId: product.id,
      productScore: null,
      tooFew: true,
      split: { positive: 0, mixed: 0, negative: 0 },
      verdict: 'Not enough lived comments yet for a Product Score.',
      verdictMarks: [],
      frags: frags.length
        ? frags
        : [
            {
              text: `Still gathering what people say about ${product.name}`,
              mark: product.name,
              source: 'yt',
            },
          ],
      clusters: [],
      counts,
      basis: `Found ${total} comments so far across YouTube and Sourced owners. A score from that few would mislead you.`,
      source: 'heuristic',
      analyzedAt: new Date().toISOString(),
    };
  }

  const posN = tagged.filter((t) => t.pol === 'positive').length;
  const negN = tagged.filter((t) => t.pol === 'negative').length;
  const mixN = total - posN - negN;
  const positive = Math.round((posN / total) * 100);
  const negative = Math.round((negN / total) * 100);
  const mixed = clamp(100 - positive - negative, 0, 100);
  const productScore = clamp(Math.round(positive + mixed / 2), 1, 99);

  const interesting = tagged
    .filter((t) => t.pol !== 'mixed' || NEG.some((w) => t.text.toLowerCase().includes(w)))
    .sort((a, b) => b.text.length - a.text.length);

  const frags: MarkedFrag[] = [];
  for (const row of interesting) {
    if (frags.length >= 6) break;
    const text = shortLine(row.text);
    if (frags.some((f) => f.text.slice(0, 40) === text.slice(0, 40))) continue;
    frags.push({ text, mark: pickMark(text), source: row.source });
  }
  while (frags.length < 4 && tagged[frags.length]) {
    const row = tagged[frags.length];
    const text = shortLine(row.text);
    frags.push({ text, mark: pickMark(text), source: row.source });
  }

  const toneWord =
    productScore >= 75 ? 'Mostly liked' : productScore >= 55 ? 'Mixed feedback' : 'Cautious overall';
  const markPhrase =
    positive >= negative
      ? interesting.find((t) => t.pol === 'positive')?.text.slice(0, 48) ?? 'what owners report'
      : interesting.find((t) => t.pol === 'negative')?.text.slice(0, 48) ?? 'common complaints';

  const clusters: ClaimCluster[] = [
    {
      title: positive >= 30 ? 'People report visible improvement' : 'Some positive outcomes',
      who: 'Across commenters',
      percent: Math.max(8, positive),
      tone: 'sage' as ClaimCluster['tone'],
      quotes: tagged
        .filter((t) => t.pol === 'positive')
        .slice(0, 2)
        .map((t) => ({ source: t.source, text: shortLine(t.text, 110), mark: pickMark(shortLine(t.text, 110)) })),
    },
    {
      title: negative >= 15 ? 'Irritation, pilling or dryness comes up' : 'A few caution notes',
      who: 'Mentioned across sources',
      percent: Math.max(5, negative),
      tone: (negative >= 20 ? 'coral' : 'honey') as ClaimCluster['tone'],
      quotes: tagged
        .filter((t) => t.pol === 'negative')
        .slice(0, 2)
        .map((t) => ({ source: t.source, text: shortLine(t.text, 110), mark: pickMark(shortLine(t.text, 110)) })),
    },
  ].filter((c) => c.quotes.length > 0);

  return {
    productId: product.id,
    productScore,
    tooFew: false,
    split: { positive, mixed: mixed || mixN, negative },
    verdict: `${toneWord}. Strongest signal in the comments: ${markPhrase.replace(/\s+/g, ' ').trim()}.`,
    verdictMarks: [markPhrase.replace(/\s+/g, ' ').trim().slice(0, 42)],
    frags,
    clusters,
    counts,
    basis: `Read from ${total.toLocaleString()} comments: ${counts.yt.toLocaleString()} on YouTube and ${counts.own} from Sourced owners. Reddit not connected yet.`,
    source: 'heuristic',
    analyzedAt: new Date().toISOString(),
  };
}

function parseLlmJson(raw: string): Partial<ProductCaseAnalysis> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Partial<ProductCaseAnalysis>;
  } catch {
    return null;
  }
}

async function callProductCaseApi(payload: {
  product: { id: string; name: string; brand: string; ingredients: string[] };
  ytComments: string[];
  ownerComments: string[];
}): Promise<ProductCaseAnalysis | null> {
  try {
    const response = await fetch('/api/product-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { analysis?: ProductCaseAnalysis; error?: string };
    if (json.analysis?.productId) return json.analysis;
    return null;
  } catch {
    return null;
  }
}

/** Fit score only — never mixed into Product Score. */
export function computeFitScore(
  product: Product,
  profile: Profile | null,
): { score: number; label: string; why: string } {
  if (!profile || profile.skinType === 'unknown') {
    return {
      score: 0,
      label: 'Pick your skin type',
      why: 'We compare this product to people like you once you set a skin type.',
    };
  }
  const listed = product.suitsSkinTypes.filter((t) => t !== 'unknown');
  let score = 70;
  if (listed.length === 0) score = 68;
  else if (listed.includes(profile.skinType)) score = 88;
  else score = 38;

  const label =
    score >= 80
      ? `Stronger reports for ${profile.skinType} skin`
      : score >= 55
        ? `Mixed for ${profile.skinType} skin`
        : `Weaker signal for ${profile.skinType} skin`;

  return {
    score,
    label,
    why: listed.includes(profile.skinType)
      ? `Catalog lists ${profile.skinType} among skin types it suits. This is Confidence for you — not the Product Score.`
      : `Based on catalog skin tags and your ${profile.skinType} profile. Separate from what commenters said overall.`,
  };
}

export async function loadProductCase(
  product: Product,
  userPosts: CommunityPost[] = [],
): Promise<ProductCaseAnalysis> {
  const cached = memory.get(product.id);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  const { ytBodies, ownerBodies, counts } = await gatherCaseEvidence(product, userPosts);

  const llm = await callProductCaseApi({
    product: {
      id: product.id,
      name: product.name,
      brand: product.brand,
      ingredients: product.ingredients,
    },
    ytComments: ytBodies.slice(0, 80),
    ownerComments: ownerBodies.slice(0, 40),
  });

  let data: ProductCaseAnalysis;
  if (llm) {
    data = {
      ...llm,
      counts: { ...counts, ...llm.counts, rd: llm.counts?.rd ?? 0 },
      source: 'llm',
      analyzedAt: llm.analyzedAt || new Date().toISOString(),
    };
  } else {
    data = heuristicFromBodies(product, ytBodies, ownerBodies, counts);
  }

  memory.set(product.id, { at: Date.now(), data });
  return data;
}

export function renderMarkedText(
  text: string,
  marks: string[],
): Array<{ text: string; marked: boolean }> {
  if (!marks.length) return [{ text, marked: false }];
  const lower = text.toLowerCase();
  let best: { i: number; len: number } | null = null;
  for (const mark of marks) {
    if (!mark?.trim()) continue;
    const i = lower.indexOf(mark.toLowerCase());
    if (i >= 0 && (!best || i < best.i)) best = { i, len: mark.length };
  }
  if (!best) return [{ text, marked: false }];
  const before = text.slice(0, best.i);
  const mid = text.slice(best.i, best.i + best.len);
  const after = text.slice(best.i + best.len);
  const parts: Array<{ text: string; marked: boolean }> = [];
  if (before) parts.push({ text: before, marked: false });
  parts.push({ text: mid, marked: true });
  if (after) parts.push({ text: after, marked: false });
  return parts;
}
