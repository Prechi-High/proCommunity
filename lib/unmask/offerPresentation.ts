export function offerDiscount(price?: number | null, was?: number | null) {
  return price != null &&
    was != null &&
    Number.isFinite(price) &&
    Number.isFinite(was) &&
    price >= 0 &&
    was > price
    ? Math.floor(((was - price) / was) * 100)
    : 0;
}
export function offerMoney(price: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}
