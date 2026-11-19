import { MOMENT_SOUNDS, type SoundOption } from "@/lib/moment/creatorCatalog";
import type { CreatorSettings } from "@/lib/moment/types";

export type PreviewLayers = {
  backgroundUri: string | null;
  backgroundMode: "original" | "blur" | "scene";
  sceneBlurAmount: number;
  lookTint: string | null;
  lookOpacity: number;
  lightOverlay: string | null;
  lightOpacity: number;
  sound: SoundOption | null;
  soundLabel: string | null;
};

/** Sound-only compose — studio BG/looks/FX removed from create. */
export function resolvePreviewLayers(creator: CreatorSettings): PreviewLayers {
  const sound = creator.soundId ? (MOMENT_SOUNDS.find((s) => s.id === creator.soundId) ?? null) : null;
  const soundLabel = creator.localSoundName || sound?.title || (creator.localSoundUri ? "Your audio" : null);

  return {
    backgroundUri: null,
    backgroundMode: "original",
    sceneBlurAmount: 0,
    lookTint: null,
    lookOpacity: 0,
    lightOverlay: null,
    lightOpacity: 0,
    sound,
    soundLabel,
  };
}
