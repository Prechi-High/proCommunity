/**
 * YouTube-only evidence acquisition audit (live API).
 * Usage: node scripts/run-youtube-evidence-audit.mjs [product query]
 * Env: loads .env.local — requires YOUTUBE_DATA_API_KEY
 * Sets EVIDENCE_AUDIT_YOUTUBE_ONLY=1 for gather path (other providers off).
 */
import { loadProjectEnv } from "./load-env-file.mjs";

const env = loadProjectEnv();
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v;
}
process.env.EVIDENCE_AUDIT_YOUTUBE_ONLY = "1";

const offline = process.argv.includes("--offline");
const query = process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) ?? "CeraVe Daily Moisturizing Lotion";
const productId = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const { presetsForDomain } = await import("../supabase/functions/_shared/blueprint/presets.ts");
const { inferDomainFromCategory, planEvidenceQueries } = await import(
  "../supabase/functions/_shared/evidence/queryPlanner.ts"
);
const { runYoutubeAcquisitionAudit } = await import(
  "../supabase/functions/_shared/evidence/audit/youtubeAcquisitionAudit.ts"
);
const { gatherConversationEvidence } = await import(
  "../supabase/functions/_shared/evidence/gatherConversationEvidence.ts"
);
const { assessExperienceQuality } = await import("../supabase/functions/_shared/evidence/experienceQuality.ts");
const { buildEvidenceSearchInputFromProfile } = await import(
  "../supabase/functions/_shared/evidence/enrichProfile.ts"
);
const { traceIntelligenceFunnel } = await import("../supabase/functions/_shared/evidence/audit/youtubeFunnel.ts");
const { PROVIDER_CAPS } = await import("../supabase/functions/_shared/evidence/providers/config.ts");

const domain = inferDomainFromCategory("moisturizer");
const preset = presetsForDomain(domain).find((p) => p.productType === "moisturizer") ?? presetsForDomain(domain)[0];

const profile = {
  identity: { name: query, brand: "CeraVe", category: "Moisturizer" },
  category: "Moisturizer",
};

const profileBeauty = {
  ...profile,
  identity: { ...profile.identity, category: "Beauty moisturizer" },
  category: "Beauty moisturizer",
};
const evidenceInput = buildEvidenceSearchInputFromProfile(productId, query, profileBeauty);
evidenceInput.dimensions = preset.dimensions;
let acquisition;
if (offline) {
  const planned = planEvidenceQueries(evidenceInput);
  const cap = PROVIDER_CAPS.youtube;
  acquisition = {
    offline: true,
    productName: evidenceInput.productName,
    plannedQueriesFromPlanner: planned.map((p) => p.query),
    plannedQueryCount: planned.length,
    actualYoutubeSearchQueries: [
      `${evidenceInput.brand ? `${evidenceInput.brand} ` : ""}${evidenceInput.productName} review`.trim(),
    ],
    searchApiRequests: 1,
    maxResultsPerSearch: 4,
    searchPaginationImplemented: false,
    theoreticalMaxVideos: 4,
    theoreticalMaxCommentPages: 4,
    theoreticalMaxTopLevelThreads: 4 * 50,
    commentPaginationImplemented: false,
    commentsListApiRequests: 0,
    providerCap: cap,
    note: "Offline — set YOUTUBE_DATA_API_KEY in .env.local and rerun without --offline for live counts.",
  };
} else {
  acquisition = await runYoutubeAcquisitionAudit(evidenceInput);
}

const gathered = offline
  ? { items: [], queries: planEvidenceQueries(evidenceInput).map((p) => p.query), diagnostics: { youtube: { status: "skipped", items: 0 } } }
  : await gatherConversationEvidence(evidenceInput, { useCache: false });
const ytOnly = gathered.items.filter((i) => i.provider === "youtube");

const blueprintId = `preset_${preset.productType}`;
const enrichedProfile = {
  ...profile,
  conversationEvidence: ytOnly.map((item) => ({
    id: `${item.provider}:${item.sourceId}`,
    provider: item.provider,
    platform: item.platform,
    sourceId: item.sourceId,
    text: item.text,
    author: item.author,
    url: item.url,
    title: item.title,
    experienceQuality: item.experienceQuality,
  })),
  voices: [],
};

const funnel = traceIntelligenceFunnel({
  rawProviderItems: ytOnly,
  productId,
  blueprintId,
  query,
  target: { name: query, brand: "CeraVe", query },
  dimensions: preset.dimensions,
  profileForPipeline: enrichedProfile,
});

function pct(n, total) {
  if (!total) return "0.0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

const report = {
  testProduct: query,
  productId,
  domain,
  phase1_youtubeOnly: true,
  acquisition,
  gatherConversationEvidence: {
    plannedQueries: gathered.queries,
    diagnostics: gathered.diagnostics,
    youtubeItemsAfterExperienceQuality: ytOnly.length,
    affectsScoring: ytOnly.filter((i) => i.experienceQuality.affectsScoring).length,
  },
  intelligenceFunnel: funnel,
  caps: {
    MAX_YOUTUBE_EVIDENCE: PROVIDER_CAPS.youtube,
    meaning: "Maximum normalized RawEvidence items returned by youtube provider per investigate call (stops search/comment loop when reached). NOT search result count alone.",
  },
};

console.log(JSON.stringify(report, null, 2));

console.log("\n--- SUMMARY ---");
console.log(`Planned queries (planner): ${acquisition.plannedQueryCount}`);
console.log(`Actual YouTube search queries: ${acquisition.actualYoutubeSearchQueries.length}`);
console.log(`Search API requests: ${acquisition.searchApiRequests}`);
console.log(`Videos discovered (max ${acquisition.maxResultsPerSearch}): ${acquisition.videoResultsReturned}`);
console.log(`Comment thread requests: ${acquisition.commentThreadsApiRequests}`);
console.log(`Raw thread rows (top+reply): ${acquisition.totalRawConversationRows}`);
console.log(`Provider returned items (cap ${acquisition.providerCap}): ${acquisition.providerReturnedItems}`);
console.log(`Valid score evidence (post-pipeline trace): ${funnel.validScoreEvidenceCount}`);
console.log(`Est. YouTube quota units: ${acquisition.estimatedQuotaUnits.total}`);
