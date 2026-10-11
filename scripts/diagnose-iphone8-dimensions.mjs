/**
 * Prints sufficiency diagnostics for iPhone 8 dimensions (fixture or profile JSON path).
 */
import { readFileSync } from "node:fs";

const { buildDimensionExperiencePackage } = await import(
  "../supabase/functions/_shared/evidence/pipeline.ts"
);

const profilePath = process.argv[2];
const profile = profilePath
  ? JSON.parse(readFileSync(profilePath, "utf8"))
  : {
      identity: { name: "iPhone 8", brand: "Apple", category: "Tech smartphone" },
      conversationEvidence: [],
    };

const blueprintDims = [
  ...(profile.blueprintLlm?.dimensions ?? []),
  ...(profile.blueprintLlm?.secondary_dimensions ?? []),
];
const dims = blueprintDims.length
  ? blueprintDims
  : [
      { key: "ergonomics", label: "Ergonomics", importance: 0.9, keywords: ["hand", "size", "one-handed"] },
      { key: "performance_longevity", label: "Performance Longevity", importance: 0.85, keywords: ["slow", "lag", "months"] },
    ];

const { package: pkg } = buildDimensionExperiencePackage({
  productId: "iphone-8",
  blueprintId: "bp_smartphone",
  query: "iPhone 8",
  profile,
  dimensions: dims,
});

const report = dims.map((d) => {
  const b = pkg.byKey[d.key];
  if (!b) return { dimension: d.key, error: "missing" };
  const scoring = b.items.filter((i) => i.affectsScore);
  return {
    dimension: d.key,
    label: d.label,
    totalMappedEvidence: b.evidenceCount,
    scoreAffectingEvidence: scoring.length,
    uniqueAuthors: b.uniqueAuthorCount,
    uniqueVideos: b.uniqueVideoCount,
    uniqueSources: b.uniqueSourceCount,
    positive: b.positiveCount,
    mixed: b.mixedCount,
    negative: b.negativeCount,
    avgRelevance: b.sufficiencyGate?.avgRelevance,
    avgProductMatch: b.sufficiencyGate?.avgProductMatch,
    confidence: b.confidence,
    score_display: b.scoreDisplay,
    limitedReason: b.sufficiencyGate?.displayReason,
    failedConditions: b.sufficiencyGate?.failedConditions,
  };
});

console.log(JSON.stringify({ product: "iPhone 8", report }, null, 2));
