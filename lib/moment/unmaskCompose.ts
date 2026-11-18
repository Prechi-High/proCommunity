import {
  MOMENT_BACKGROUNDS,
  MOMENT_LIGHTING,
  MOMENT_LOOKS,
  MOMENT_SOUNDS,
  type SoundOption,
} from "@/lib/moment/creatorCatalog";
import type { CreatorSettings } from "@/lib/moment/types";

export type PreviewLayers = {
  backgroundUri: string | null;
  backgroundMode: "original" | "blur" | "scene";
  lookTint: string | null;
  lookOpacity: number;
  lightOverlay: string | null;
  lightOpacity: number;
  sound: SoundOption | null;
  soundLabel: string | null;
};

const LIGHTING_OVERLAY: Record<string, { color: string; opacity: number }> = {
  natural: { color: "#FFFFFF", opacity: 0 },
  soft: { color: "#FFF8F4", opacity: 0.12 },
  warm: { color: "#FFE2B8", opacity: 0.18 },
  studio: { color: "#F5E0FF", opacity: 0.14 },
};

export function resolvePreviewLayers(creator: CreatorSettings): PreviewLayers {
  const bgId = creator.backgroundId ?? "original";
  const catalogBg = MOMENT_BACKGROUNDS.find((b) => b.id === bgId);

  let backgroundMode: PreviewLayers["backgroundMode"] = "original";
  let backgroundUri: string | null = null;

  if (creator.localBackgroundUri) {
    backgroundMode = "scene";
    backgroundUri = creator.localBackgroundUri;
  } else if (catalogBg?.mode === "blur") {
    backgroundMode = "blur";
  } else if (bgId === "custom" && creator.localBackgroundUri) {
    backgroundMode = "scene";
    backgroundUri = creator.localBackgroundUri;
  } else if (catalogBg?.mode === "studio" && catalogBg.sceneUri) {
    backgroundMode = "scene";
    backgroundUri = catalogBg.sceneUri;
  }

  const look =
    creator.lookId && creator.lookId !== "none" ? MOMENT_LOOKS.find((l) => l.id === creator.lookId) : undefined;
  const lighting = MOMENT_LIGHTING.find((l) => l.id === creator.lightingId);
  const light = lighting ? LIGHTING_OVERLAY[lighting.id] ?? LIGHTING_OVERLAY.natural : LIGHTING_OVERLAY.natural;

  const sound = creator.soundId ? (MOMENT_SOUNDS.find((s) => s.id === creator.soundId) ?? null) : null;
  const soundLabel = creator.localSoundName || sound?.title || (creator.localSoundUri ? "Your audio" : null);

  return {
    backgroundUri,
    backgroundMode,
    lookTint: look?.preview ?? null,
    lookOpacity: look ? 0.22 : 0,
    lightOverlay: light.opacity > 0 ? light.color : null,
    lightOpacity: light.opacity,
    sound,
    soundLabel,
  };
}