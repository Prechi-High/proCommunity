import type { Product } from "@/lib/types";
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Only exact identity matches may reuse another product's community records. */
export function exactCommunityMatch(
  product: Pick<Product, "name" | "brand">,
  candidates: Product[],
) {
  const labels = new Set([
    normalized(product.name),
    normalized(`${product.brand || ""} ${product.name}`),
  ]);
  const matches = candidates.filter((c) => {
    const name = normalized(c.name),
      full = normalized(`${c.brand || ""} ${c.name}`);
    const brandCompatible =
      !product.brand ||
      !c.brand ||
      normalized(product.brand) === normalized(c.brand);
    return brandCompatible && (labels.has(name) || labels.has(full));
  });
  return matches.length === 1 ? matches[0] : null;
}
