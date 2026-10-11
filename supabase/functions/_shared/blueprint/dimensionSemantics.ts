import type { BlueprintDimensionDef, ProductClassification } from "./types.ts";

export type EnrichedDimensionDef = BlueprintDimensionDef & {
  description?: string;
  positiveSignals: string[];
  negativeSignals: string[];
  relatedConcepts: string[];
  excludedConcepts: string[];
};

function splitPhrases(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[,;/]|\band\b/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 12);
}

/** Derive semantic metadata from blueprint fields when LLM did not supply them. */
export function enrichDimensionSemantics(
  dim: BlueprintDimensionDef,
  classification?: ProductClassification,
): EnrichedDimensionDef {
  const label = dim.label.toLowerCase();
  const key = dim.key.replace(/_/g, " ");
  const why = (dim.whyItMatters ?? "").toLowerCase();

  const relatedConcepts = [
    ...splitPhrases(why),
    ...dim.keywords.map((k) => k.toLowerCase()),
    key,
    label,
  ];

  const excludedConcepts: string[] = [];
  if (/battery health|degradation|cycle/.test(`${key} ${label}`)) {
    excludedConcepts.push("charging speed", "fast charge", "charger quality", "initial battery endurance");
  }
  if (/ergonomic|hand|size|grip/.test(`${key} ${label}`)) {
    excludedConcepts.push("camera", "speaker", "display brightness");
  }
  if (/irritat|sensitiv/.test(`${key} ${label}`)) {
    excludedConcepts.push("scent", "packaging", "price");
  }

  const positiveSignals = dim.positiveSignals?.length
    ? dim.positiveSignals
    : relatedConcepts.filter((c) => /\b(good|great|smooth|comfort|last|strong)\b/.test(c) === false).slice(0, 8);

  const negativeSignals = dim.negativeSignals?.length
    ? dim.negativeSignals
    : relatedConcepts
        .filter((c) => /slow|bad|irritat|fail|poor|weak/.test(c))
        .concat(
          label.includes("battery") ? ["drain", "degradation", "swollen"] : [],
          label.includes("heat") ? ["warm", "hot", "thermal", "overheat"] : [],
        )
        .slice(0, 8);

  if (classification?.riskFactors?.length) {
    for (const r of classification.riskFactors.slice(0, 3)) {
      if (r.length > 4) relatedConcepts.push(r.toLowerCase());
    }
  }

  return {
    ...dim,
    description: dim.description ?? dim.whyItMatters,
    positiveSignals: Array.from(new Set(positiveSignals)),
    negativeSignals: Array.from(new Set(negativeSignals)),
    relatedConcepts: Array.from(new Set(relatedConcepts)).slice(0, 16),
    excludedConcepts: Array.from(new Set(excludedConcepts)),
  };
}
