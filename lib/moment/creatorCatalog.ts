/** Curated creator catalog — licensed / project-owned demo assets for the studio library. */

export type SoundOption = {
  id: string;
  title: string;
  artist: string;
  duration: string;
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

const DEMO_SOUND =
  "https://cdn.pixabay.com/download/audio/2022/03/24/audio_8b2b3338b8.mp3?filename=lofi-study-112191.mp3";

export const MOMENT_SOUNDS: SoundOption[] = [
  { id: "soft-glow", title: "Soft Glow", artist: "Unmask Originals", duration: "0:32", category: "Beauty / GRWM", previewUri: DEMO_SOUND, trending: true },
  { id: "morning-hum", title: "Morning Hum", artist: "Unmask Originals", duration: "0:28", category: "Chill", previewUri: DEMO_SOUND, trending: true },
  { id: "night-room", title: "Night Room", artist: "Unmask Originals", duration: "0:41", category: "Chill", previewUri: DEMO_SOUND },
  { id: "grwm-beat", title: "GRWM Beat", artist: "Unmask Originals", duration: "0:36", category: "Trending", previewUri: DEMO_SOUND, trending: true },
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

export const MOMENT_BACKGROUNDS: BackgroundOption[] = [
  { id: "original", title: "Original", mode: "original", thumb: "#2D1B1B" },
  { id: "blur", title: "Portrait blur", mode: "blur", thumb: "#6B5B63" },
  {
    id: "studio-pink",
    title: "Studio Pink",
    mode: "studio",
    sceneUri: SCENE_PINK,
    thumb: SCENE_PINK,
  },
  {
    id: "studio-cream",
    title: "Studio Cream",
    mode: "studio",
    sceneUri: SCENE_CREAM,
    thumb: SCENE_CREAM,
  },
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