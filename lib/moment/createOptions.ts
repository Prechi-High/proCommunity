import type { MomentKind } from "./kinds";

export type CreateUnmaskOption =
  | { kind: "moment"; id: MomentKind; title: string; subtitle: string; emoji: string }
  | { kind: "experience"; id: "product-story"; title: string; subtitle: string; emoji: string };

/** Rows on “Create an Unmask” — matches product mock copy. */
export const CREATE_UNMASK_OPTIONS: CreateUnmaskOption[] = [
  { kind: "moment", id: "morning", title: "My Morning", subtitle: "Start the day with me", emoji: "☀️" },
  {
    kind: "moment",
    id: "grwm",
    title: "GRWM",
    subtitle: "Get ready with me (for a date, work, party, etc.)",
    emoji: "💋",
  },
  { kind: "moment", id: "evening", title: "My Evening", subtitle: "Wind down with me", emoji: "🕯️" },
  { kind: "moment", id: "currently", title: "Currently Using", subtitle: "What's in my routine right now", emoji: "🧴" },
  {
    kind: "experience",
    id: "product-story",
    title: "My Product Story",
    subtitle: "What happened when I used this product?",
    emoji: "📸",
  },
];

export const CREATE_HERO_IMAGE =
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80";