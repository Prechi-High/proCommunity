import { fallbackBlueprint } from "./fallbackBlueprint.ts";
import type { DomainResolution } from "../domain/types.ts";
import type { BuiltBlueprintPackage } from "./build.ts";
import { generateProductBlueprintLlm } from "./llmBlueprint.ts";

type Json = Record<string, unknown>;

export async function getOrBuildBlueprintPackage(
  productId: string,
  query: string,
  profile: Json,
  domainResolution?: DomainResolution,
): Promise<BuiltBlueprintPackage> {
  const identity = (profile.identity ?? {}) as Json;
  const template = fallbackBlueprint(productId, identity, query);
  // Established product-type templates define experience outcomes; the LLM assesses their evidence.
  if (template.classification.productType !== "general") return template;
  const prepared = profile.preparedBlueprint as BuiltBlueprintPackage | undefined;
  const factKeys = new Set(Array.isArray(prepared?.llmJson?.fact_field_candidates) ? prepared.llmJson.fact_field_candidates as string[] : []);
  if (prepared?.blueprintId && prepared.dimensions?.length && !prepared.dimensions.some(d => factKeys.has(d.key))) return prepared;
  const specs = (Array.isArray(profile.specs) ? profile.specs : []) as Array<{ label?: string; value?: string }>;
  try {
  const generated = await generateProductBlueprintLlm({
    productId,
    query,
    identity: {
      name: String(identity.name ?? ""),
      brand: String(identity.brand ?? ""),
      category: String(identity.category ?? ""),
      subcategory: String(identity.subcategory ?? ""),
    },
    summary: String(profile.summary ?? profile.verdict ?? ""),
    specs,
    domainResolution,
  });

  const generatedFactKeys = new Set(Array.isArray(generated.json.fact_field_candidates) ? generated.json.fact_field_candidates : []);
  const experienceDimensions = generated.dimensions.filter(d => !generatedFactKeys.has(d.key));
  if (experienceDimensions.length < 4) return template;
  const version = 2;
  const blueprintId = `bp_${productId}_v${version}`;

  return {
    classification: generated.classification,
    factSections: generated.factSections,
    dimensions: experienceDimensions,
    blueprintId,
    version,
    generatedByModel: generated.model ?? "blueprint-llm",
    llmJson: generated.json as Record<string, unknown>,
  };
  } catch {
    return fallbackBlueprint(productId, identity, query);
  }
}
