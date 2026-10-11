/** Client mirror of supabase/functions/_shared/investigation/canonicalDisplay.ts */
export type IdentificationState =
  | 'identified'
  | 'high_confidence_match'
  | 'user_verified'
  | 'externally_verified';

export type CanonicalProductDisplay = {
  canonicalDisplayName: string;
  variantDisplay: string;
  rawListingTitle: string;
  identificationState: IdentificationState;
};

const SKIP_VARIANT = /^(unlocked|locked|gsm|cdma|lte|5g|wifi|wi-fi|new|renewed|refurbished)$/i;
const REGION = /^(ca|us|uk|eu|au|de|fr)$/i;
const MODEL_CODE = /^[a-z]\d{3,5}$/i;

function normalizeStorage(text: string): string | null {
  const m = text.match(/\b(\d+)\s*(gb|tb)\b/i);
  if (!m) return null;
  return `${m[1]} ${m[2].toUpperCase()}`;
}

function titleCaseColor(fragment: string): string {
  const t = fragment.replace(/[()]/g, '').trim();
  if (!t || t.length > 32) return '';
  if (/^\d/.test(t) || MODEL_CODE.test(t) || REGION.test(t)) return '';
  if (SKIP_VARIANT.test(t)) return '';
  return t
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function canonicalFromListing(raw: string, brand?: string): CanonicalProductDisplay {
  const rawListingTitle = raw.trim();
  const parts = rawListingTitle.split(/\s*[-–|]\s*/).map((p) => p.trim()).filter(Boolean);
  let head = parts[0] ?? rawListingTitle;
  if (brand && !head.toLowerCase().includes(brand.toLowerCase())) {
    head = `${brand} ${head}`.replace(/\s+/g, ' ').trim();
  }

  const variantBits: string[] = [];
  const storageFromRaw = normalizeStorage(rawListingTitle);
  if (storageFromRaw) variantBits.push(storageFromRaw);

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const storage = normalizeStorage(p);
    if (storage && !variantBits.includes(storage)) {
      variantBits.push(storage);
      continue;
    }
    const color = titleCaseColor(p);
    if (color && !variantBits.some((v) => v.toLowerCase() === color.toLowerCase())) variantBits.push(color);
  }

  let canonicalDisplayName = head.replace(/\s+/g, ' ').trim();
  if (brand) {
    const re = new RegExp(`^${brand}\\s+`, 'i');
    const rest = canonicalDisplayName.replace(re, '').trim();
    if (rest && rest.length < canonicalDisplayName.length) canonicalDisplayName = `${brand} ${rest}`.trim();
  }

  return {
    canonicalDisplayName: canonicalDisplayName.slice(0, 120) || rawListingTitle.slice(0, 80),
    variantDisplay: variantBits.slice(0, 4).join(' · '),
    rawListingTitle,
    identificationState: 'identified',
  };
}

export function identificationBadgeLabel(state: IdentificationState): string | null {
  switch (state) {
    case 'user_verified':
    case 'externally_verified':
      return 'Verified product';
    case 'high_confidence_match':
      return 'High-confidence match';
    case 'identified':
      return 'Product identified';
    default:
      return null;
  }
}
