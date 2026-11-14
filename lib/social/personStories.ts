import { PREVIEW_MOMENTS, type PulseMoment } from "@/lib/social/previewMoments";

/** Stories for one person only — segment count = queue length for the progress bars. */
export function previewStoriesForPerson(personId: string): PulseMoment[] {
  return PREVIEW_MOMENTS.filter((m) => m.id === personId);
}

export function nextPreviewPersonId(currentId: string): string | null {
  const ids = PREVIEW_MOMENTS.map((m) => m.id);
  const index = ids.indexOf(currentId);
  if (index < 0 || index >= ids.length - 1) return null;
  return ids[index + 1] ?? null;
}