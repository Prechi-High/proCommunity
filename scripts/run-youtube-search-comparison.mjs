/**
 * Compare YouTube search modes for one product (requires YOUTUBE_DATA_API_KEY).
 *
 *   node scripts/run-youtube-search-comparison.mjs "CeraVe Daily Moisturizing Lotion"
 */
import { loadProjectEnv } from "./load-env-file.mjs";

const env = loadProjectEnv();
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const query = process.argv[2] ?? "CeraVe Daily Moisturizing Lotion";
const productId = query.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const hasKey = Boolean((process.env.YOUTUBE_DATA_API_KEY ?? "").trim());

if (!hasKey) {
  console.log(JSON.stringify({ error: "YOUTUBE_DATA_API_KEY missing", product: query }, null, 2));
  process.exit(1);
}

const { presetsForDomain } = await import("../supabase/functions/_shared/blueprint/presets.ts");
const { inferDomainFromCategory } = await import("../supabase/functions/_shared/evidence/queryPlanner.ts");
const { harvestYoutubeEvidence } = await import("../supabase/functions/_shared/evidence/providers/youtube/harvest.ts");

const domain = inferDomainFromCategory("Beauty moisturizer");
const preset = presetsForDomain(domain).find((p) => p.productType === "moisturizer") ?? presetsForDomain(domain)[0];

const baseInput = {
  productId,
  productName: query,
  brand: "CeraVe",
  domain,
  dimensions: preset.dimensions,
  forceRefresh: true,
};

async function run(mode) {
  const t0 = Date.now();
  const { items, diagnostics: d } = await harvestYoutubeEvidence({ ...baseInput, youtubeSearchMode: mode });
  return {
    mode,
    runtimeMs: Date.now() - t0,
    searchCalls: d.searchRequests,
    queriesExecuted: d.queriesExecuted?.length ?? 0,
    uniqueVideos: d.uniqueVideos,
    metadataRequests: d.metadataRequests,
    commentPages: d.commentPagesFetched,
    replyRequests: d.replyRequests,
    quotaSearchBucket: d.quotaSearchBucket,
    quotaGeneralUnits: d.quotaGeneralUnits,
    quotaBatchStats: d.quotaBatchStatsBucket,
    rawComments: d.rawCommentsRetrieved,
    providerItems: d.providerNormalizedItems,
    validScoreEvidence: d.finalScoreEvidence,
    validPerRequest: d.finalScoreEvidence / Math.max(1, d.requestsUsed),
  };
}

const separate = await run("separate");
const bundled = await run("bundled");

console.log(
  JSON.stringify(
    {
      product: query,
      comparison: { separate, bundled },
      notes: [
        "search.list costs 1 unit in Search Queries bucket (not 100 general units)",
        "commentThreads.list and videos.list cost 1 general unit per call",
        "Bundled OR returns one ranked list per call — recall differs from separate queries",
        "commentThreads.list does not support multi-video id batching",
      ],
    },
    null,
    2,
  ),
);
