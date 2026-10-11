# Dynamic Product Intelligence — completion report

## Architecture delivered

| Area | Implementation |
|------|----------------|
| Blueprint source | `supabase/functions/_shared/blueprint/llmBlueprint.ts` — LLM JSON generator (no runtime preset fallback) |
| Dimension scores | `scoreDimensions.ts` — owner evidence sentiment; not claim agreement scores |
| Read path | `cache.ts` + `index.ts` — **Redis → Supabase → LLM** (`cache:product:{id}:blueprint`) |
| Ask | `ask/storedEvidence.ts` + `ask_unmask` / stored-first `ask` action |
| UI | Dynamic identify preview, evidence filters, video groups, ask context |

## Example blueprint JSON (fixtures used in tests)

See `supabase/functions/_shared/blueprint/__tests__/parity.test.ts` for smartphone, foundation, mountain bike payloads.

### Smartphone (excerpt)

```json
{
  "domain": "tech",
  "product_type": "smartphone",
  "fact_sections": [{ "key": "specs", "label": "Specs", "renderer": "fact_grid" }],
  "dimensions": [
    { "key": "camera_quality", "label": "Camera" },
    { "key": "battery_endurance", "label": "Battery" },
    { "key": "performance", "label": "Performance" },
    { "key": "heat_management", "label": "Heat" }
  ]
}
```

**Navigation:** Overview · Specs · Evidence · Videos · Ask  
**Evidence filters / video groups:** Camera, Battery, Performance, Heat (from contract dimensions)

### Foundation

**Navigation:** Overview · Ingredients · Product Details · Evidence · Videos · Ask  
**Dimensions:** Coverage, Longevity, Oxidation, Transfer (no `camera_quality`)

### Mountain bike (inferred)

**Navigation:** Overview · Materials · Evidence · Videos · Ask  
**Dimensions:** Handling, Braking, Comfort, Durability

## Redis behavior

1. **Hit:** `readBlueprintCache` returns presentation + optional `uiContract`; `intelligenceMeta.cacheSource = redis`
2. **Miss:** load Supabase blueprint → hydrate Redis via `writeBlueprintCache`
3. **Stale/missing:** `getOrBuildBlueprintPackage` → LLM → persist → write Redis

## Ask evidence reuse

1. `ask_unmask` / `ask` tries `answerFromStoredEvidence` (blueprint facts, dimensions, claim evidence, discoveries)
2. Cached answers: `cache:product:{id}:ask:{hash}`
3. Falls through to community `runAsk` only when stored evidence insufficient

## Tests

```bash
npx tsx --test supabase/functions/_shared/blueprint/__tests__/parity.test.ts
npx tsx --test lib/product-result/__tests__/dynamic-ui.test.ts
```

## Legacy still behind flags

- `EXPO_PUBLIC_DYNAMIC_PRODUCT_UI` / `DYNAMIC_PRODUCT_UI` — legacy `ScorecardTab`, `DIMENSION_SEEDS`, `presets.ts` (tests/docs only; not used in blueprint build path)
- `classify.ts` / `presets.ts` retained for reference, not called from `getOrBuildBlueprintPackage`

## Unrelated `tsc` failures (not modified)

- `lib/claims/scoring.ts`, `lib/providers/serper.ts`, `lib/services/evidence-engine/*`, `lib/services/llmExtraction.ts`, `lib/services/product-identification/*`, `lib/services/productIntelligence.ts`, `lib/services/search-discovery/*`

## Ops

Redeploy `product-intelligence` edge function; ensure `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` and LLM keys are set.
