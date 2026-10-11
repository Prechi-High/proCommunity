export function normalizeAlias(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bproducts\b/g, "product")
    .trim();
}

export function slugFromDomainName(name: string): string {
  return normalizeAlias(name).replace(/\s+/g, "-").replace(/&/g, "and").slice(0, 64);
}

const BLOCKED_DOMAIN_PHRASES = [
  /\bsmartwatch\b/i,
  /\bsmartphone\b/i,
  /\bfoundation\b/i,
  /\blipstick\b/i,
  /\bdash\s*cam/i,
  /\bmountain\s*bike\b/i,
  /\brunning\s*shoes\b/i,
  /\bwearables\b/i,
];

/** Product types must not become domains. */
export function isNarrowDomainCandidate(name: string): boolean {
  const n = name.trim();
  if (n.length < 4) return true;
  return BLOCKED_DOMAIN_PHRASES.some((re) => re.test(n));
}
