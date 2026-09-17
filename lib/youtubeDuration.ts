export const MAX_YOUTUBE_SECONDS = 5 * 60;

export function isoDurationToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!iso) return null;
  return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
}

export function isShortFormYoutube(seconds: number | null | undefined): boolean {
  return typeof seconds === 'number' && seconds > 0 && seconds <= MAX_YOUTUBE_SECONDS;
}
