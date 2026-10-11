/**
 * YouTube-only acceptance harness (3 products).
 * Requires YOUTUBE_DATA_API_KEY in .env.local for live runs.
 */
import { loadProjectEnv } from "./load-env-file.mjs";

const env = loadProjectEnv();
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v;
}
process.env.EVIDENCE_AUDIT_YOUTUBE_ONLY = "1";

const PRODUCTS = [
  {
    label: "moisturizer",
    query: "CeraVe Daily Moisturizing Lotion",
    brand: "CeraVe",
    category: "Beauty moisturizer",
    productType: "moisturizer",
  },
  {
    label: "smartphone",
    query: "iPhone 16 Pro",
    brand: "Apple",
    category: "Tech smartphone",
    productType: "smartphone",
  },
  {
    label: "air_fryer",
    query: "Ninja Air Fryer",
    brand: "Ninja",
    category: "Home air fryer",
    productType: "air_fryer",
  },
];

const { presetsForDomain } = await import("../supabase/functions/_shared/blueprint/presets.ts");
const { inferDomainFromCategory, planEvidenceQueries, selectYoutubeSearchQueries } = await import(
  "../supabase/functions/_shared/evidence/queryPlanner.ts"
);
const { gatherConversationEvidence } = await import(
  "../supabase/functions/_shared/evidence/gatherConversationEvidence.ts"
);
const { buildDimensionExperiencePackage } = await import("../supabase/functions/_shared/evidence/pipeline.ts");

const hasKey = Boolean((process.env.YOUTUBE_DATA_API_KEY ?? "").trim());
const offline = process.argv.includes("--offline") || !hasKey;

const results = [];

for (const p of PRODUCTS) {
  const t0 = Date.now();
  const productId = p.query.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const domain = inferDomainFromCategory(p.category);
  const preset =
    presetsForDomain(domain).find((x) => x.productType === p.productType) ?? presetsForDomain(domain)[0];
  const input = {
    productId,
    productName: p.query,
    brand: p.brand,
    domain,
    dimensions: preset.dimensions,
    category: p.category,
  };
  const planned = planEvidenceQueries(input);
  const selected = selectYoutubeSearchQueries(planned, 12);

  if (offline) {
    results.push({
      product: p.query,
      offline: true,
      plannedQueries: planned.length,
      selectedQueries: selected.map((s) => s.query),
      note: "Set YOUTUBE_DATA_API_KEY for live acceptance metrics",
    });
    continue;
  }

  const gathered = await gatherConversationEvidence(
    { ...input, aliases: [p.query] },
    { useCache: false, forceRefresh: true },
  );
  const yt = gathered.items.filter((i) => i.provider === "youtube");
  const profile = {
    identity: { name: p.query, brand: p.brand, category: p.category },
    conversationEvidence: yt.map((item) => ({
      id: `${item.provider}:${item.sourceId}`,
      provider: item.provider,
      platform: item.platform,
      sourceId: item.sourceId,
      text: item.text,
      author: item.author,
      url: item.url,
      title: item.title,
      experienceQuality: item.experienceQuality,
      conversationId: item.conversationId,
    })),
    voices: [],
  };
  const blueprintId = `preset_${preset.productType}`;
  const { package: pkg, rows } = buildDimensionExperiencePackage({
    productId,
    blueprintId,
    query: p.query,
    profile,
    dimensions: preset.dimensions,
  });
  let links = 0;
  for (const d of preset.dimensions) {
    links += (pkg.byKey[d.key]?.items ?? []).filter((i) => i.affectsScore).length;
  }
  const acq = gathered.youtubeAcquisition ?? gathered.diagnostics.youtube?.acquisition ?? {};
  results.push({
    product: p.query,
    runtimeMs: Date.now() - t0,
    plannedQueries: planned.length,
    executedQueries: acq.queriesExecuted ?? [],
    discoveredVideos: acq.videosDiscovered,
    harvestedVideos: acq.videosHarvested,
    rawComments: acq.rawCommentsRetrieved,
    providerItems: yt.length,
    validProductEvidence: acq.finalScoreEvidence,
    validDimensionLinks: links,
    persistedRows: rows.length,
    quota: acq.quotaUnitsEstimated,
    stoppedBecause: acq.stoppedBecause,
    dimensionStats: acq.dimensionStats,
  });
}

console.log(JSON.stringify({ offline, results }, null, 2));
