export type MomentKind = "morning" | "grwm" | "evening" | "currently";

export type MomentConfig = {
  id: MomentKind;
  title: string;
  emoji: string;
  tagline: string;
  chooseSubtitle: string;
  captureSubtitle: string;
  completeTitle: string;
  /** Camera overlay tint */
  tint: string;
  /** Scrim for evening */
  scrim?: string;
  border: readonly [string, string];
  /** Default capture: GRWM leans video */
  defaultMode: "photo" | "video";
  cardImage: string;
  stickers: string[];
  videoFirst?: boolean;
};

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

export const MOMENTS: MomentConfig[] = [
  {
    id: "morning",
    title: "MY MORNING",
    emoji: "☀️",
    tagline: "Start the day with me.",
    chooseSubtitle: "Start the day with me.",
    captureSubtitle: "Capture your morning.",
    completeTitle: "Complete your Morning Unmask",
    tint: "rgba(255, 214, 160, 0.18)",
    border: ["#F0CF69", "#E8B95A"],
    defaultMode: "photo",
    cardImage: img("photo-1616394584738-fc6e612125bb"),
    stickers: ["Skincare", "Makeup", "Hair", "Body", "Other"],
  },
  {
    id: "grwm",
    title: "GRWM",
    emoji: "💋",
    tagline: "Get ready with me.",
    chooseSubtitle: "Get ready with me.",
    captureSubtitle: "Get ready with me.",
    completeTitle: "Add to your GRWM",
    tint: "rgba(255, 160, 190, 0.2)",
    border: ["#FF8BC8", "#C94B8A"],
    defaultMode: "video",
    videoFirst: true,
    cardImage: img("photo-1522335789203-aabd1fc54bc9"),
    stickers: ["Skincare", "Makeup", "Hair", "Outfit"],
  },
  {
    id: "evening",
    title: "MY EVENING",
    emoji: "🌙",
    tagline: "Wind down with me.",
    chooseSubtitle: "Wind down with me.",
    captureSubtitle: "Wind down with me.",
    completeTitle: "Complete your Evening Unmask",
    tint: "rgba(60, 30, 80, 0.35)",
    scrim: "rgba(20, 8, 28, 0.25)",
    border: ["#6B4C9A", "#2D1530"],
    defaultMode: "photo",
    cardImage: img("photo-1570172619644-dfd03ed5d881"),
    stickers: ["Skincare", "Hair", "Body", "Self-care"],
  },
  {
    id: "currently",
    title: "CURRENTLY USING",
    emoji: "✨",
    tagline: "What I'm using right now.",
    chooseSubtitle: "What I'm using right now.",
    captureSubtitle: "Show us what's in your routine right now.",
    completeTitle: "Complete your Unmask",
    tint: "rgba(247, 238, 212, 0.22)",
    border: ["#D4AF37", "#C9A227"],
    defaultMode: "photo",
    cardImage: img("photo-1616683693504-3ea7e9ad6fec"),
    stickers: ["Shelfie", "Holding product", "In use"],
  },
];

export function momentConfig(kind: MomentKind): MomentConfig {
  return MOMENTS.find((m) => m.id === kind) ?? MOMENTS[0];
}

export const GRWM_OCCASIONS = ["Everyday", "Date night", "Event", "Going out", "Just because"] as const;
export const USAGE_DURATION = ["Just started", "1–2 weeks", "1 month", "2+ months"] as const;