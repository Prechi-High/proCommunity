import { runIdentityEvaluation, runRelevanceEvaluation } from "../supabase/functions/_shared/evidence/evaluation/metrics.ts";
import { ALL_IDENTITY_LABELS, RELEVANCE_LABELS } from "../supabase/functions/_shared/evidence/evaluation/labeledExamples.ts";
import { currentEvidenceFingerprint } from "../supabase/functions/_shared/evidence/versions.ts";

const identity = runIdentityEvaluation();
const relevance = runRelevanceEvaluation();

console.log(
  JSON.stringify(
    {
      versions: currentEvidenceFingerprint(),
      labeledExamples: {
        identity: ALL_IDENTITY_LABELS.length,
        relevance: RELEVANCE_LABELS.length,
      },
      identityMetrics: identity,
      relevanceMetrics: relevance,
    },
    null,
    2,
  ),
);
