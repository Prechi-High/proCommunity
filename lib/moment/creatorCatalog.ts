/** Curated creator catalog — project-owned demo assets with reliable CORS audio. */

export type SoundOption = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSec: number;
  category: string;
  previewUri: string;
  trending?: boolean;
};

export type LookOption = { id: string; title: string; preview: string; thumb: string };
export type BackgroundOption = {
  id: string;
  title: string;
  mode: "original" | "blur" | "studio";
  sceneUri?: string;
  thumb?: string;
};
export type LightingOption = { id: string; title: string; hint: string };
export type EffectOption = { id: string; title: string; provider: "unmask" | "snap"; hint: string };

/** Stable CORS-friendly MP3s (SoundHelix / remotion). */
const S1 = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
const S2 = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3";
const S3 = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";
const S4 = "https://remotion.media/audio.mp3";

export const MOMENT_SOUNDS: SoundOption[] = [
  { id: "soft-glow", title: "Soft Glow", artist: "Unmask Originals", duration: "6:12", durationSec: 372, category: "Beauty / GRWM", previewUri: S1, trending: true },
  { id: "morning-hum", title: "Morning Hum", artist: "Unmask Originals", duration: "7:05", durationSec: 425, category: "Chill", previewUri: S2, trending: true },
  { id: "night-room", title: "Night Room", artist: "Unmask Originals", duration: "5:48", durationSec: 348, category: "Chill", previewUri: S3 },
  { id: "grwm-beat", title: "GRWM Beat", artist: "Unmask Originals", duration: "0:08", durationSec: 8, category: "Trending", previewUri: S4, trending: true },
];

export const MOMENT_LOOKS: LookOption[] = [
  { id: "none", title: "Original", preview: "#F9F5EB", thumb: "#E8E0DC" },
  { id: "natural", title: "Natural", preview: "#F9F5EB", thumb: "#F3E8DC" },
  { id: "velvet", title: "Velvet", preview: "#8E4052", thumb: "#C9718A" },
  { id: "dew", title: "Dew", preview: "#C4E8F7", thumb: "#9FD4EE" },
  { id: "golden", title: "Golden hour", preview: "#E8C07A", thumb: "#F2D89A" },
];

const SCENE_PINK =
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80";
const SCENE_CREAM =
  "https://images.unsplash.com/photo-1616628188859-7a11abc34b1f?auto=format&fit=crop&w=1200&q=80";
const SCENE_CITY =
  "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80";
const SCENE_GLOW =
  "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1200&q=80";

export const MOMENT_BACKGROUNDS: BackgroundOption[] = [
  { id: "original", title: "Original", mode: "original", thumb: "#2D1B1B" },
  { id: "blur", title: "Portrait blur", mode: "blur", thumb: "#6B5B63" },
  { id: "studio-pink", title: "Studio Pink", mode: "studio", sceneUri: SCENE_PINK, thumb: SCENE_PINK },
  { id: "studio-cream", title: "Studio Cream", mode: "studio", sceneUri: SCENE_CREAM, thumb: SCENE_CREAM },
  { id: "city-night", title: "City Night", mode: "studio", sceneUri: SCENE_CITY, thumb: SCENE_CITY },
  { id: "soft-glow-bg", title: "Soft Glow Room", mode: "studio", sceneUri: SCENE_GLOW, thumb: SCENE_GLOW },
];

export const MOMENT_LIGHTING: LightingOption[] = [
  { id: "natural", title: "Natural", hint: "As captured" },
  { id: "soft", title: "Soft fill", hint: "Even out shadows" },
  { id: "warm", title: "Warm glow", hint: "Golden warmth" },
  { id: "studio", title: "Studio", hint: "Bright beauty light" },
];

export const MOMENT_EFFECTS: EffectOption[] = [
  { id: "none", title: "None", provider: "unmask", hint: "No effect" },
  { id: "sparkle-dust", title: "Sparkle dust", provider: "unmask", hint: "Subtle sparkle overlay" },
  { id: "snap-soft-focus", title: "Soft focus", provider: "snap", hint: "Lens-style soft focus" },
];

export const PRODUCT_CATEGORY_FILTERS = ["Cleanser", "Moisturizer", "Sunscreen", "Serum", "Toner", "Mask"] as const;

export const SKIN_TYPES = ["Combination", "Dry", "Oily", "Sensitive", "Normal"] as const;
export const SKIN_GOALS = ["Glow", "Hydration", "Clear skin", "Even tone", "Calm redness"] as const;
export const MOOD_LOOKS = ["Soft glam", "Natural", "Bold lip", "No-makeup", "Date night"] as const;

export const SAMPLE_TRENDS = [
  {
    id: "glass-skin-week",
    title: "Glass Skin Week",
    prompt: "Show your hydrating layers and finish",
    momentKind: "grwm" as const,
    soundId: "soft-glow",
    lookId: "dew",
  },
  {
    id: "spf-every-day",
    title: "SPF Every Day",
    prompt: "Unmask how you wear SPF in your routine",
    momentKind: "morning" as const,
    soundId: "morning-hum",
    lookId: "natural",
  },
] as const;

export function selectedSoundLabel(creator: {
  soundId?: string;
  localSoundName?: string;
}): string | null {
  if (creator.localSoundName) return creator.localSoundName;
  if (!creator.soundId) return null;
  return MOMENT_SOUNDS.find((s) => s.id === creator.soundId)?.title ?? null;
}

export function selectedSoundDurationSec(creator: { soundId?: string }): number | null {
  if (!creator.soundId) return null;
  return MOMENT_SOUNDS.find((s) => s.id === creator.soundId)?.durationSec ?? null;
}