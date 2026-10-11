import type { EnrichedDimensionDef } from "../../blueprint/dimensionSemantics.ts";
import type { ProductMatchLevel } from "../types.ts";

export type BatchClassificationCandidate = {
  evidenceId: string;
  text: string;
  contextText?: string;
  videoTitle?: string;
  dimensionCandidates: EnrichedDimensionDef[];
};

export type BatchClassificationMapping = {
  dimension_key: string;
  relevance_confidence: number;
  stance: "positive" | "mixed" | "negative" | "neutral";
  extracted_statement: string;
};

export type BatchClassificationResult = {
  evidence_id: string;
  product_match: {
    level: ProductMatchLevel | "exact_contextual";
    confidence: number;
  };
  mappings: BatchClassificationMapping[];
};

export type BatchSemanticClassifier = {
  classify(candidates: BatchClassificationCandidate[]): Promise<BatchClassificationResult[]>;
};

/** Default: no LLM — pipeline uses deterministic resolver + semantic mapper only. */
export const noopBatchClassifier: BatchSemanticClassifier = {
  async classify() {
    return [];
  },
};

const BATCH_SIZE = 50;

export function chunkCandidates<T>(items: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
