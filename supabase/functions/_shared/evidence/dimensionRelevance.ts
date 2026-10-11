import type { BlueprintDimensionDef } from "../blueprint/types.ts";
import type { DimensionRelevanceResult } from "./types.ts";
import { extractDimensionStatement, mapTextToDimensions } from "./relevance/mapDimensions.ts";

/** @deprecated Use mapTextToDimensions */
export function mapStatementToDimensions(
  statement: string,
  dimensions: BlueprintDimensionDef[],
  productAffectsScore: boolean,
): DimensionRelevanceResult[] {
  return mapTextToDimensions(statement, dimensions, productAffectsScore);
}

export function extractDimensionSnippet(statement: string, dim: BlueprintDimensionDef): string {
  return extractDimensionStatement(statement, dim);
}

export { mapTextToDimensions, extractDimensionStatement } from "./relevance/mapDimensions.ts";
