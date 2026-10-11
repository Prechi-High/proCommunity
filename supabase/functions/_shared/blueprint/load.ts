import type { ProductPresentationContract, PresentationDimension, PresentationFactField, PresentationNavItem } from "./types.ts";

type Json = Record<string, unknown>;

type Store = {
  select(table: string, filter: string): Promise<Json | null>;
  rows(path: string): Promise<Json[]>;
};

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function loadPresentationFromDb(store: Store, productId: string): Promise<ProductPresentationContract | null> {
  const bps = await store.rows(
    `product_blueprints?product_id=eq.${encodeURIComponent(productId)}&status=eq.active&order=version.desc&limit=1`,
  );
  const bp = bps[0];
  if (!bp?.id) return null;
  const blueprintId = String(bp.id);
  const version = Number(bp.version ?? 1);
  if (bp.refresh_after && +new Date(String(bp.refresh_after)) < Date.now()) return null;

  const navRows = await store.rows(
    `blueprint_sections?blueprint_id=eq.${encodeURIComponent(blueprintId)}&enabled=eq.true&order=display_order.asc`,
  );
  const navigation: PresentationNavItem[] = navRows.map((r) => ({
    key: str(r.section_key, 40),
    label: str(r.label, 80),
    renderer: str(r.renderer_type, 40),
  }));

  const factSectionRows = await store.rows(
    `product_fact_sections?blueprint_id=eq.${encodeURIComponent(blueprintId)}&status=eq.active&order=display_order.asc`,
  );
  const factSections = await Promise.all(
    factSectionRows.map(async (s) => {
      const sectionId = String(s.id);
      const fields = await store.rows(
        `product_fact_fields?fact_section_id=eq.${encodeURIComponent(sectionId)}&order=display_order.asc`,
      );
      return {
        key: str(s.section_key, 40),
        title: str(s.title, 80),
        renderer: str(s.renderer_type, 40),
        fields: fields.map((f) => {
          const val = f.value as Json | null;
          const text = typeof val?.text === "string" ? val.text : JSON.stringify(val ?? "");
          return {
            key: str(f.field_key, 40),
            label: str(f.label, 80),
            value: text,
            unit: f.unit ? str(f.unit, 20) : null,
          } satisfies PresentationFactField;
        }),
      };
    }),
  );

  const dimRows = await store.rows(
    `evaluation_dimensions?blueprint_id=eq.${encodeURIComponent(blueprintId)}&status=eq.active&order=display_order.asc`,
  );
  const dimensions: PresentationDimension[] = [];
  for (const d of dimRows) {
    const dimId = String(d.id);
    const assessRows = await store.rows(
      `dimension_assessments?dimension_id=eq.${encodeURIComponent(dimId)}&order=computed_at.desc&limit=1`,
    );
    const assess = assessRows[0];
    const evidenceCount = Number(assess?.evidence_count ?? 0);
    const confidence = Number(assess?.confidence_score ?? 0);
    dimensions.push({
      key: str(d.key, 40),
      label: str(d.label, 80),
      score: assess?.score !== null && assess?.score !== undefined ? Number(assess.score) : null,
      confidence,
      evidenceCount,
      limitedEvidence: evidenceCount < 5 || confidence < 0.45,
      finding: assess?.finding ? str(assess.finding) : undefined,
    });
  }

  const domain = str(bp.product_type, 40).includes("foundation") ? "beauty" : (
    str(bp.category_id).includes("beauty") ? "beauty" : str(bp.category_id).includes("home") ? "home-appliances" : "tech"
  ) as ProductPresentationContract["product"]["category"];

  const scored = dimensions.map((d) => d.score).filter((s): s is number => s !== null);
  const overviewScore = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  return {
    version: 1,
    blueprintId,
    blueprintVersion: version,
    product: {
      id: productId,
      category: domain,
      productType: str(bp.product_type, 60),
      productSubtype: bp.product_subtype ? str(bp.product_subtype, 60) : null,
    },
    navigation,
    overview: {
      score: overviewScore,
      verdict: "Owner-backed scores for what matters on this product.",
      dimensions,
    },
    factSections,
  };
}
