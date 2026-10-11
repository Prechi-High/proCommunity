import type { BlueprintDimensionDef } from "../blueprint/types.ts";
import type { DimensionRelevanceResult, EvidenceStance } from "./types.ts";

type DimCtx = { key: string; label: string; keywords: string[] };

const PURITY_SIGNALS =
  /\b(pure|purity|unrefined|refined|cold[- ]?pressed|expeller|virgin|extra[- ]?virgin|adulterat|contamin|certif|usda\s+organic|organic\s+standard|hexane|bleach|deodoriz|additive|processing quality|unprocessed)\b/i;

const VALUE_SIGNALS =
  /\b(best value|good value|great value|worth the (money|price)|bang for|affordable|cheap|price|cost|value for money)\b/i;

const VERSATILITY_SIGNALS =
  /\b(versatile|versatility|multi[- ]?use|many uses|works wonders for cooking|for cooking|great for cooking|hair|skin care|beauty routine)\b/i;

const LEXICON: Record<string, RegExp[]> = {
  hydration: [
    /\b(hydrat|moistur|dry skin|dehydrat|quench|plump)\b/i,
    /\b(least moistur|not moistur|doesn'?t moistur)\b/i,
  ],
  absorption: [
    /\b(absorb|soak in|sinks in|greasy|sticky|film|tacky|residue)\b/i,
    /\b(absorbs immediately|quickly absorb)\b/i,
  ],
  texture: [/\b(texture|thick|thin|rich|lightweight|creamy|gel)\b/i],
  irritation: [/\b(irritat|burn|sting|sensitive|redness|rash|eczema)\b/i],
  coverage: [/\b(cover|coverage|conceal|full cover)\b/i],
  wear_longevity: [/\b(last|longevity|wear|hours|fade|transfer)\b/i],
  camera_quality: [/\b(camera|photo|video|lens|selfie|night mode)\b/i],
  battery_endurance: [/\b(battery|charge|endurance|drain|mah)\b/i],
  display_experience: [/\b(display|screen|oled|brightness|refresh)\b/i],
  charging_speed: [/\b(charg|watt|fast charg|usb-c)\b/i],
  cooking_consistency: [/\b(cook|crisp|even|bake|fry)\b/i],
  noise: [/\b(noise|loud|quiet|vibrat)\b/i],
  handling: [/\b(handle|steer|corner|agile)\b/i],
  braking: [/\b(brak|stop|disc)\b/i],
  purity_standard: [PURITY_SIGNALS],
  purity: [PURITY_SIGNALS],
  certification: [PURITY_SIGNALS],
  processing_quality: [/\b(cold[- ]?pressed|unrefined|refined|expeller|hexane|bleach|deodoriz|processed)\b/i],
  value: [VALUE_SIGNALS],
  value_for_money: [VALUE_SIGNALS],
  versatility: [VERSATILITY_SIGNALS],
};

function isPurityDimension(dim: DimCtx): boolean {
  const hay = `${dim.key} ${dim.label}`.toLowerCase();
  return /purity|certification|adulter|organic.?standard/.test(hay);
}

function isValueDimension(dim: DimCtx): boolean {
  const hay = `${dim.key} ${dim.label}`.toLowerCase();
  return /\bvalue\b|worth|price|cost/.test(hay);
}

function isVersatilityDimension(dim: DimCtx): boolean {
  const hay = `${dim.key} ${dim.label}`.toLowerCase();
  return /versatil|multi.?use/.test(hay);
}

function isProcessingDimension(dim: DimCtx): boolean {
  const hay = `${dim.key} ${dim.label}`.toLowerCase();
  return /process|refin|pressed/.test(hay);
}

function stanceFromText(text: string): EvidenceStance {
  const pos = /\b(love|great|excellent|amazing|recommend|perfect|best|quick|fast|smooth)\b/i.test(text);
  const neg = /\b(bad|terrible|hate|worst|awful|disappoint|regret|avoid|least|poor|greasy|sticky|film)\b/i.test(text);
  if (pos && neg) return "mixed";
  if (neg) return "negative";
  if (pos) return "positive";
  return "neutral";
}

function lexiconHit(key: string, text: string): boolean {
  const patterns = LEXICON[key];
  if (patterns?.some((re) => re.test(text))) return true;
  const base = key.replace(/_/g, " ");
  return text.toLowerCase().includes(base);
}

function semanticSupportsDimension(statement: string, dim: DimCtx): { ok: boolean; confidence: number; reason: string } {
  const text = statement.toLowerCase();

  if (dim.key === "absorption" && /\b(least moistur|not moistur|dry skin|hydrat)\b/i.test(statement) && !/\b(absorb|greasy|sticky|film|soak)\b/i.test(statement)) {
    return { ok: false, confidence: 0.12, reason: "hydration_not_absorption" };
  }
  if (dim.key === "hydration" && /\b(absorb|soak in|sinks in)\b/i.test(statement) && !/\b(moistur|hydrat|dry)\b/i.test(statement)) {
    return { ok: false, confidence: 0.15, reason: "absorption_not_hydration" };
  }

  if (isPurityDimension(dim)) {
    if (VALUE_SIGNALS.test(statement) && !PURITY_SIGNALS.test(statement)) {
      return { ok: false, confidence: 0.1, reason: "value_not_purity" };
    }
    if (VERSATILITY_SIGNALS.test(statement) && !PURITY_SIGNALS.test(statement)) {
      return { ok: false, confidence: 0.1, reason: "versatility_not_purity" };
    }
    if (/\b(cooking|recipe|fry|sauté|bake)\b/i.test(statement) && !PURITY_SIGNALS.test(statement)) {
      return { ok: false, confidence: 0.1, reason: "use_case_not_purity" };
    }
    if (PURITY_SIGNALS.test(statement) || lexiconHit(dim.key, statement)) {
      return { ok: true, confidence: 0.86, reason: "purity_signal" };
    }
    const kwOrganic = dim.keywords.some((k) => k.length > 2 && text.includes(k.toLowerCase()));
    if (kwOrganic && !PURITY_SIGNALS.test(statement)) {
      return { ok: false, confidence: 0.12, reason: "keyword_without_purity_semantics" };
    }
    return { ok: false, confidence: 0.08, reason: "no_purity_signal" };
  }

  if (isValueDimension(dim) && VALUE_SIGNALS.test(statement)) {
    return { ok: true, confidence: 0.84, reason: "value_signal" };
  }

  if (isVersatilityDimension(dim) && VERSATILITY_SIGNALS.test(statement)) {
    return { ok: true, confidence: 0.82, reason: "versatility_signal" };
  }

  if (isProcessingDimension(dim) && (LEXICON.processing_quality?.some((re) => re.test(statement)) || lexiconHit(dim.key, statement))) {
    return { ok: true, confidence: 0.83, reason: "processing_signal" };
  }

  if (lexiconHit(dim.key, statement)) {
    return { ok: true, confidence: 0.82, reason: "lexicon" };
  }

  const kwHit = dim.keywords.some((k) => k.length > 2 && text.includes(k.toLowerCase()));
  if (kwHit) {
    return { ok: true, confidence: 0.55, reason: "keyword_prefilter" };
  }

  return { ok: false, confidence: 0.08, reason: "no_semantic_support" };
}

const RELEVANCE_THRESHOLD = 0.5;

/** Semantic dimension relevance (keyword pre-filter + lexicon rules). */
export function mapStatementToDimensions(
  statement: string,
  dimensions: BlueprintDimensionDef[],
  productAffectsScore: boolean,
): DimensionRelevanceResult[] {
  if (!productAffectsScore) return [];

  const candidates = dimensions.filter((d) => {
    const sem = semanticSupportsDimension(statement, { key: d.key, label: d.label, keywords: d.keywords });
    if (sem.ok && sem.confidence >= RELEVANCE_THRESHOLD) return true;
    return d.keywords.some((k) => k.length > 2 && statement.toLowerCase().includes(k.toLowerCase()));
  });
  const pool = candidates.length ? candidates : [];

  const out: DimensionRelevanceResult[] = [];
  for (const d of pool) {
    const sem = semanticSupportsDimension(statement, { key: d.key, label: d.label, keywords: d.keywords });
    if (!sem.ok || sem.confidence < RELEVANCE_THRESHOLD) continue;
    const stance = stanceFromText(statement);
    const strength = Math.min(0.95, sem.confidence * (stance === "mixed" ? 0.75 : 0.9));
    out.push({
      dimensionKey: d.key,
      relevanceConfidence: sem.confidence,
      stance,
      strength,
      affectsScore: true,
      reason: sem.reason,
    });
  }
  return out;
}
