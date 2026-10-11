import type { BlueprintDimensionDef } from "../blueprint/types.ts";
import type { DimensionRelevanceResult, EvidenceStance } from "./types.ts";

type DimCtx = { key: string; label: string; keywords: string[] };

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
};

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

  const candidates = dimensions.filter((d) =>
    d.keywords.some((k) => k.length > 2 && statement.toLowerCase().includes(k.toLowerCase())),
  );
  const pool = candidates.length ? candidates : dimensions;

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
