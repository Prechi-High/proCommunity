import type { MomentKind } from "@/lib/moment/kinds";

/** Demo mapping so Updates sections have preview content. */
export const PREVIEW_MOMENT_KIND: Record<string, MomentKind> = {
  "m-zuri": "grwm",
  "m-ife": "grwm",
  "m-ada": "morning",
  "m-tunde": "morning",
  "m-lola": "evening",
  "m-ken": "evening",
  "m-malik": "currently",
  "m-nene": "currently",
};

export function previewKindFor(personId: string): MomentKind | undefined {
  return PREVIEW_MOMENT_KIND[personId];
}