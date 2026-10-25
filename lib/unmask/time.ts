export function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const then = +new Date(iso);
  if (!Number.isFinite(then)) return '';
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 45) return 'Just now';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function initials(name?: string | null) {
  const parts = (name || 'U').trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();
}

const AVATAR_TONES = ['#3D0F15', '#70323E', '#5C534F', '#7A4B00', '#236044'] as const;

export function avatarTone(name?: string | null) {
  const n = name || 'U';
  let h = 0;
  for (let i = 0; i < n.length; i += 1) h = (h + n.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[h];
}
