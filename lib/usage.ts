import type { Product, UsageEstimate } from './types';

export function withUsageDates(
  estimate: UsageEstimate,
  product: Product,
): UsageEstimate {
  if (!product.typicalDurationDays && !product.shelfLifeMonths) return estimate;
  const start = new Date(estimate.startedAt);
  const empty =
    product.typicalDurationDays != null
      ? new Date(start.getTime() + product.typicalDurationDays * 86400000)
      : null;
  const expiry =
    product.shelfLifeMonths != null
      ? new Date(start)
      : null;
  if (expiry && product.shelfLifeMonths != null) {
    expiry.setMonth(expiry.getMonth() + product.shelfLifeMonths);
  }
  return {
    ...estimate,
    estimatedEmptyDate: empty?.toISOString() ?? null,
    expiryDate: expiry?.toISOString() ?? null,
  };
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((+new Date(iso) - Date.now()) / 86400000);
}
