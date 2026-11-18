/** Curated creator catalog — rights-safe placeholders until a live audio/effects backend ships. */

export type SoundOption = { id: string; title: string; artist: string; trending?: boolean };
export type LookOption = { id: string; title: string; preview: string };
export type BackgroundOption = { id: string; title: string; mode: "original" | "blur" | "studio" };
export type LightingOption = { id: string; title: string };
export type EffectOption = { id: string; title: string; provider: "unmask" | "snap" };

export const MOMENT_SOUNDS: SoundOption[] = [
  { id: "soft-glow", title: "Soft Glow", artist: "Unmask Studio", trending: true },
  { id: "morning-hum", title: "Morning Hum", artist: "Unmask Studio", trending: true },
  { id: "night-room", title: "Night Room", artist: "Unmask Studio" },
  { id: "grwm-beat", title: "GRWM Beat", artist: "Unmask Studio", trending: true },
];

export const MOMENT_LOOKS: LookOption[] = [
  { id: "natural", title: "Natural", preview: "#F9F5EB" },
  { id: "velvet", title: "Velvet", preview: "#8E4052" },
  { id: "dew", title: "Dew", preview: "#C4E8F7" },
  { id: "golden", title: "Golden hour", preview: "#E8C07A" },
];

export const MOMENT_BACKGROUNDS: BackgroundOption[] = [
  { id: "original", title: "Original", mode: "original" },
  { id: "blur", title: "Blur", mode: "blur" },
  { id: "studio-pink", title: "Studio Pink", mode: "studio" },
  { id: "studio-cream", title: "Studio Cream", mode: "studio" },
];

export const MOMENT_LIGHTING: LightingOption[] = [
  { id: "natural", title: "Natural" },
  { id: "soft", title: "Soft fill" },
  { id: "warm", title: "Warm glow" },
  { id: "studio", title: "Studio" },
];

export const MOMENT_EFFECTS: EffectOption[] = [
  { id: "none", title: "None", provider: "unmask" },
  { id: "sparkle-dust", title: "Sparkle dust", provider: "unmask" },
  { id: "snap-soft-focus", title: "Soft focus", provider: "snap" },
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