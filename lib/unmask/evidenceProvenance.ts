import type { DimensionEvidenceItem } from './dimensionEvidence';

export function formatEvidenceProvenance(e: DimensionEvidenceItem): string {
  const parts: string[] = [];
  const platform = (e.platform || e.provider || 'web').toLowerCase();
  if (platform === 'unmask') parts.push('Unmask experience');
  else if (platform.includes('youtube')) parts.push('YouTube');
  else parts.push(e.platform || 'Owner');

  if (e.isReply) parts.push('Reply');
  else if (platform.includes('youtube')) parts.push('Direct owner comment');

  if (e.createdAt) {
    const age = formatRelativeAge(e.createdAt);
    if (age) parts.push(age);
  }

  return parts.join(' · ');
}

function formatRelativeAge(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const months = Math.round((Date.now() - t) / (30 * 24 * 3600 * 1000));
  if (months < 1) return 'recent';
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
