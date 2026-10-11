import type { BlueprintDimensionDef, PresentationDimension } from "./types.ts";

type Json = Record<string, unknown>;

type Snippet = { text: string; origin: string };

const POS = /\b(love|great|excellent|amazing|recommend|worth|perfect|best|happy|smooth|easy|quiet|fast|accurate|comfortable)\b/i;
const NEG = /\b(bad|terrible|awful|hate|broken|regret|avoid|disappoint|fail|poor|loud|slow|inaccurate|uncomfortable|overheat|leak)\b/i;

function collectOwnerSnippets(profile: Json): Snippet[] {
  const out: Snippet[] = [];
  const push = (text: string, origin: string) => {
    const t = text.trim();
    if (t.length > 12) out.push({ text: t.slice(0, 420), origin });
  };

  for (const v of (Array.isArray(profile.voices) ? profile.voices : []) as Json[]) {
    push(String(v.text ?? ""), String(v.platform ?? "Owner"));
  }
  for (const p of (Array.isArray(profile.praise) ? profile.praise : []) as Json[]) {
    push(String(p.text ?? p.summary ?? ""), String(p.source ?? "Review"));
  }
  for (const c of (Array.isArray(profile.complaints) ? profile.complaints : []) as Json[]) {
    push(String(c.text ?? c.summary ?? ""), String(c.source ?? "Review"));
  }

  const findings = profile.findings as Json | undefined;
  const claims = (Array.isArray(findings?.claims) ? findings!.claims : []) as Json[];
  for (const claim of claims) {
    const evidence = (Array.isArray(claim.evidence) ? claim.evidence : []) as Json[];
    for (const e of evidence) {
      if (e.eligible === false) continue;
      push(String(e.summary ?? ""), String(e.origin ?? "Owner report"));
    }
  }

  const discoveries = (Array.isArray(findings?.discoveries) ? findings!.discoveries : []) as Json[];
  for (const d of discoveries) {
    push(String(d.summary ?? d.observation ?? ""), "Discovery");
  }

  return out;
}

function snippetMatchesDimension(snippet: string, keywords: string[]): boolean {
  const hay = snippet.toLowerCase();
  return keywords.some((k) => k.length > 2 && hay.includes(k));
}

function sentimentScore(snippets: Snippet[]): { score: number | null; confidence: number; finding: string; evidenceCount: number } {
  if (!snippets.length) {
    return { score: null, confidence: 0.15, finding: "Not enough owner reports yet for a clear read.", evidenceCount: 0 };
  }
  let pos = 0;
  let neg = 0;
  let neu = 0;
  for (const s of snippets) {
    const p = POS.test(s.text);
    const n = NEG.test(s.text);
    if (p && !n) pos++;
    else if (n && !p) neg++;
    else neu++;
  }
  const total = pos + neg + neu;
  const evidenceCount = snippets.length;
  const agreement = total ? Math.abs(pos - neg) / total : 0;
  const confidence = Math.min(0.95, 0.25 + Math.min(evidenceCount, 30) * 0.02 + agreement * 0.35);
  if (pos + neg < 2 && evidenceCount < 4) {
    return {
      score: null,
      confidence,
      finding: snippets[0]?.text.slice(0, 180) ?? "Limited evidence so far.",
      evidenceCount,
    };
  }
  const ratio = (pos + 1) / (pos + neg + 2);
  const score = Math.round(35 + ratio * 60);
  const finding =
    pos > neg
      ? `Most owner reports lean positive (${pos} supportive vs ${neg} critical).`
      : neg > pos
        ? `Many owners report issues (${neg} critical vs ${pos} supportive).`
        : `Owners are split on this area.`;
  return { score, confidence, finding, evidenceCount };
}

/** Experience dimension scores from owner evidence — not manufacturer claim agreement scores. */
export function assessDimensionsFromOwnerEvidence(
  dimensions: BlueprintDimensionDef[],
  profile: Json,
): PresentationDimension[] {
  const snippets = collectOwnerSnippets(profile);
  return dimensions.map((d) => {
    const matched = snippets.filter((s) => snippetMatchesDimension(s.text, d.keywords));
    const { score, confidence, finding, evidenceCount } = sentimentScore(matched);
    const limitedEvidence = evidenceCount < 5 || confidence < 0.45;
    return {
      key: d.key,
      label: d.label,
      score: limitedEvidence && score !== null && confidence < 0.45 ? null : score,
      confidence,
      evidenceCount,
      limitedEvidence,
      finding: matched[0] ? `${finding} Example: “${matched[0].text.slice(0, 120)}…”` : finding,
    };
  });
}
