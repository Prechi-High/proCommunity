# Dynamic UI migration audit (Phase 0)

| File | Hardcoded behavior | Migration target |
|------|-------------------|------------------|
| `lib/unmask/derive.ts` | `DIMENSION_SEEDS` (camera, battery, …) fallback | `uiContract.overview.dimensions` / `presentation` only |
| `components/shell/ProductSubTabs.tsx` | `FALLBACK` 5-tab array | `contract.navigation` sorted by `display_order` |
| `components/unmask/ProductUnmaskFlow.tsx` | Fixed tab routing (`specs`, `evidence`, …) | `DynamicSectionRouter` + renderer registry |
| `components/product/DynamicFactPane.tsx` | Single fact layout | `ingredient_list` / `key_value_list` renderers |
| `components/unmask/ProductIdentifyView.tsx` | Hardcoded 2×2 spec grid (Storage, Display, Camera, Battery) | Pre-unmask; keep until identify uses contract preview |
| `lib/unmask/derive.ts` | `DEFAULT_SUGGESTIONS` Ask chips | Contract-driven suggestions (future) |
| `components/unmask/ScorecardTab.tsx` | Uses `bundle.dimensions` from derive | `DynamicOverview` from contract |

Feature flag: `EXPO_PUBLIC_DYNAMIC_PRODUCT_UI` (client), `DYNAMIC_PRODUCT_UI` (edge).
