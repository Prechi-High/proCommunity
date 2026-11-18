/** Occasion tiles — icon + label per GRWM reference mock (Screen 3). */
export const GRWM_OCCASION_TILES = [
  { id: "Date Night", icon: "♡", lines: ["Date", "Night"] as const },
  { id: "Work", icon: "💼", lines: ["Work"] as const },
  { id: "Girls' Night", icon: "🥂", lines: ["Girls'", "Night"] as const },
  { id: "Dinner", icon: "🍽", lines: ["Dinner"] as const },
  { id: "Party", icon: "🎉", lines: ["Party"] as const },
  { id: "Wedding", icon: "💍", lines: ["Wedding"] as const },
  { id: "Vacation", icon: "✈", lines: ["Vacation"] as const },
  { id: "Photoshoot", icon: "📸", lines: ["Photo", "shoot"] as const },
  { id: "Going Out", icon: "🛍", lines: ["Going", "Out"] as const },
  { id: "Casual Day", icon: "☕", lines: ["Casual", "Day"] as const },
  { id: "My Own", icon: "＋", lines: ["My Own"] as const, custom: true },
] as const;

export type GrwmOccasionId = (typeof GRWM_OCCASION_TILES)[number]["id"];