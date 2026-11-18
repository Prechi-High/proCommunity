/** Central upload limits — referenced by pickers and validation only. */
export const MOMENT_MEDIA_LIMITS = {
  maxVideoDurationSec: 120,
  maxPhotoFileSizeMb: 24,
  maxVideoFileSizeMb: 250,
  videoMimePrefixes: ["video/"],
  photoMimePrefixes: ["image/"],
  /** Common mobile exports */
  allowedExtensions: [".mp4", ".mov", ".m4v", ".webm", ".jpg", ".jpeg", ".png", ".heic", ".webp"],
} as const;

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function bytesToMb(bytes?: number | null): number | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  return bytes / (1024 * 1024);
}