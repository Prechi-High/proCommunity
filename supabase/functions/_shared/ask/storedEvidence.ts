import { productAskKey } from "../redis/keys.ts";
import { redisService } from "../redis/service.ts";
import { CACHE_TTL } from "../redis/ttl.ts";

type Json = Record<string, unknown>;

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function hashQuestion(q: string): string {
  let h = 0;
  const s = q.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function tokens(q: string): string[] {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

type EvidenceHit = { summary: string; origin: string; dimensionKey?: string };

function collectEvidence(profile: Json, dimensionKeys: string[]): EvidenceHit[] {
  const hits: EvidenceHit[] = [];
  const dimExp = profile.dimensionExperience as Json | undefined;
  const byKey = (dimExp?.byKey ?? {}) as Record<string, Json>;
  for (const key of dimensionKeys) {
    const bundle = byKey[key];
    const items = (Array.isArray(bundle?.items) ? bundle!.items : []) as Json[];
    for (const item of items) {
      if (item.affectsScore === false) continue;
      hits.push({
        summary: str(item.statement ?? item.summary, 360),
        origin: str(item.platform, 80) || "Owner report",
        dimensionKey: key,
      });
    }
  }
  const findings = profile.findings as Json | undefined;
  const claims = (Array.isArray(findings?.claims) ? findings!.claims : []) as Json[];
  for (const claim of claims) {
    const topic = `${claim.topic ?? ""} ${claim.criterion ?? ""}`.toLowerCase();
    const dim = dimensionKeys.find((k) => topic.includes(k.replace(/_/g, " ")) || tokens(topic).some((t) => k.includes(t)));
    const evidence = (Array.isArray(claim.evidence) ? claim.evidence : []) as Json[];
    for (const e of evidence) {
      if (e.eligible === false) continue;
      hits.push({
        summary: str(e.summary, 360),
        origin: str(e.origin, 80) || "Owner report",
        dimensionKey: dim,
      });
    }
  }
  for (const d of (Array.isArray(findings?.discoveries) ? findings!.discoveries : []) as Json[]) {
    hits.push({ summary: str(d.summary ?? d.observation, 360), origin: "Discovery" });
  }
  return hits;
}

export type AskUnmaskResult =
  | { kind: "answer"; reused: true; question: string; shortAnswer: string; evidence: EvidenceHit[]; dimensionKey?: string }
  | { kind: "insufficient"; reused: boolean; hint: string };

export async function answerFromStoredEvidence(input: {
  productId: string;
  question: string;
  profile: Json;
  askContext?: Json;
}): Promise<AskUnmaskResult> {
  const q = input.question.trim();
  if (q.length < 3) return { kind: "insufficient", reused: false, hint: "Ask a specific question about this product." };

  const cacheKey = productAskKey(input.productId, hashQuestion(q));
  const cached = await redisService.getJson<AskUnmaskResult>(cacheKey);
  if (cached.ok && cached.value?.kind === "answer") return { ...cached.value, reused: true };

  const dimensionKeys = (Array.isArray(input.askContext?.available_dimension_keys)
    ? input.askContext!.available_dimension_keys
    : []) as string[];
  const factKeys = (Array.isArray(input.askContext?.available_fact_keys) ? input.askContext!.available_fact_keys : []) as string[];

  const evidence = collectEvidence(input.profile, dimensionKeys);
  const qTokens = tokens(q);
  const ranked = evidence
    .map((e) => ({
      e,
      score: qTokens.filter((t) => e.summary.toLowerCase().includes(t)).length + (e.dimensionKey && qTokens.some((t) => e.dimensionKey!.includes(t)) ? 2 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const presentation = input.profile.presentation as Json | undefined;
  const dims = (presentation?.overview as Json | undefined)?.dimensions as Json[] | undefined;
  const dimMatch = dims?.find((d) => qTokens.some((t) => String(d.key ?? "").includes(t) || String(d.label ?? "").toLowerCase().includes(t)));

  if (ranked.length >= 3) {
    const top = ranked.slice(0, 4).map((r) => r.e);
    const shortAnswer = `Based on ${top.length} stored owner reports on this product: ${top[0].summary}`;
    const out: AskUnmaskResult = {
      kind: "answer",
      reused: true,
      question: q,
      shortAnswer,
      evidence: top,
      dimensionKey: dimMatch ? String(dimMatch.key) : top[0].dimensionKey,
    };
    await redisService.setJson(cacheKey, out, CACHE_TTL.ask());
    return out;
  }

  if (factKeys.length && qTokens.some((t) => factKeys.some((f) => f.includes(t)))) {
    const sections = (presentation?.factSections as Json[] | undefined) ?? [];
    for (const s of sections) {
      const fields = (Array.isArray(s.fields) ? s.fields : []) as Json[];
      const hit = fields.find((f) => qTokens.some((t) => String(f.key ?? "").includes(t) || String(f.label ?? "").toLowerCase().includes(t)));
      if (hit?.value) {
        const out: AskUnmaskResult = {
          kind: "answer",
          reused: true,
          question: q,
          shortAnswer: `${String(hit.label ?? hit.key)}: ${String(hit.value)}`,
          evidence: [{ summary: String(hit.value), origin: "Product facts" }],
        };
        await redisService.setJson(cacheKey, out, CACHE_TTL.ask());
        return out;
      }
    }
  }

  return {
    kind: "insufficient",
    reused: true,
    hint: "Not enough stored evidence for this question yet. Targeted research or community answers may help.",
  };
}
