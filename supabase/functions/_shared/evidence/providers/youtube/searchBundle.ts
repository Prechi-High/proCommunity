import { canonicalProductLabel, type PlannedQuery, type QueryKind } from "../../queryPlanner.ts";
import type { EvidenceSearchInput } from "../types.ts";

export type SearchExecutionPlan = {
  query: string;
  topics: string[];
  kind: "anchor" | "bundled_or" | "targeted";
  bundledTerms?: string[];
};

function normalizeSuffix(s: string): string {
  return s.replace(/^["']|["']$/g, "").trim();
}

/** Build 3–5 discovery queries using OR-bundled dimension/risk/long-term terms. */
export function buildBundledYoutubeSearchPlans(
  input: EvidenceSearchInput,
  planned: PlannedQuery[],
  maxBundles: number,
): SearchExecutionPlan[] {
  const base = canonicalProductLabel(input);
  const out: SearchExecutionPlan[] = [];
  const seen = new Set<string>();

  const push = (plan: SearchExecutionPlan) => {
    const k = plan.query.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(plan);
  };

  push({ query: base, topics: ["product"], kind: "anchor" });
  push({ query: `${base.replace(/"/g, "")} review`.replace(/\s+/g, " ").trim(), topics: ["review"], kind: "anchor" });
  push({
    query: `${base} owner review`.replace(/\s+/g, " ").trim(),
    topics: ["owner_review"],
    kind: "anchor",
  });

  const byKind: Record<QueryKind, string[]> = {
    general: [],
    long_term: [],
    risk: [],
    dimension: [],
    usage: [],
    alias: [],
  };

  for (const p of planned) {
    if (p.kind === "general") continue;
    const suffix = p.query.replace(base, "").trim();
    const term = normalizeSuffix(suffix);
    if (!term || term.length < 2) continue;
    const bucket = byKind[p.kind] ?? [];
    if (!bucket.includes(term)) bucket.push(term);
    byKind[p.kind] = bucket;
  }

  const chunk = (terms: string[], size: number): string[][] => {
    const groups: string[][] = [];
    for (let i = 0; i < terms.length; i += size) groups.push(terms.slice(i, i + size));
    return groups;
  };

  const bundles: SearchExecutionPlan[] = [];

  if (byKind.long_term.length) {
    for (const group of chunk(byKind.long_term, 4)) {
      bundles.push({
        query: `${base} ${group.join("|")}`.replace(/\s+/g, " ").trim(),
        topics: ["long_term"],
        kind: "bundled_or",
        bundledTerms: group,
      });
    }
  }
  if (byKind.risk.length) {
    for (const group of chunk(byKind.risk, 4)) {
      bundles.push({
        query: `${base} ${group.join("|")}`.replace(/\s+/g, " ").trim(),
        topics: ["risk"],
        kind: "bundled_or",
        bundledTerms: group,
      });
    }
  }
  if (byKind.dimension.length) {
    for (const group of chunk(byKind.dimension, 4)) {
      bundles.push({
        query: `${base} ${group.join("|")}`.replace(/\s+/g, " ").trim(),
        topics: ["dimension"],
        kind: "bundled_or",
        bundledTerms: group,
      });
    }
  }
  if (byKind.usage.length) {
    for (const group of chunk(byKind.usage.slice(0, 8), 4)) {
      bundles.push({
        query: `${base} ${group.join("|")}`.replace(/\s+/g, " ").trim(),
        topics: ["usage"],
        kind: "bundled_or",
        bundledTerms: group,
      });
    }
  }

  const anchorCount = out.length;
  const slots = Math.max(0, maxBundles - anchorCount);
  for (const b of bundles.slice(0, slots)) {
    push(b);
  }

  return out.slice(0, maxBundles);
}

/** Legacy: one API call per ranked planned query (up to maxQueries). */
export function buildSeparateYoutubeSearchPlans(planned: PlannedQuery[], maxQueries: number): SearchExecutionPlan[] {
  const sorted = [...planned].sort((a, b) => b.priority - a.priority);
  const out: SearchExecutionPlan[] = [];
  const seen = new Set<string>();
  for (const p of sorted) {
    const k = p.query.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ query: p.query, topics: [p.topic], kind: "anchor" });
    if (out.length >= maxQueries) break;
  }
  return out;
}
