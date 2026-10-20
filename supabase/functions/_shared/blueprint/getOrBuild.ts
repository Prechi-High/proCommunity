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
  const prepared = profile.preparedBlueprint as BuiltBlueprintPackage | undefined;
  if (prepared?.blueprintId && prepared.dimensions?.length) return prepared;
  const identity = (profile.identity ?? {}) as Json;
  const specs = (Array.isArray(profile.specs) ? profile.specs : []) as Array<{ label?: string; value?: string }>;
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

  const version = 2;
  const blueprintId = `bp_${productId}_v${version}`;

  return {
    classification: generated.classification,
    factSections: generated.factSections,
    dimensions: generated.dimensions,
    blueprintId,
    version,
    generatedByModel: generated.model ?? "blueprint-llm",
    llmJson: generated.json as Record<string, unknown>,
  };
}
