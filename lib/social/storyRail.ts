/** Labels and ring colors for the home story rail — descriptive beats, not just names. */

export type StoryRailMeta = {
  label: string;
  ring: readonly [string, string];
  glow: string;
};

const DEFAULT_RING = ["#C9A227", "#8E4052"] as const;

export const STORY_RAIL_META: Record<string, StoryRailMeta> = {
  "m-ada": { label: "Follow timeline", ring: ["#9B6BFF", "#4A2D7A"], glow: "rgba(155,107,255,0.35)" },
  "m-zuri": { label: "GRWM", ring: ["#FF7EB9", "#C94B8A"], glow: "rgba(255,126,185,0.4)" },
  "m-malik": { label: "Product timeline", ring: ["#F0CF69", "#70323E"], glow: "rgba(240,207,105,0.35)" },
  "m-nene": { label: "Good for who?", ring: ["#6EC8FF", "#3D5A9A"], glow: "rgba(110,200,255,0.35)" },
  "m-tunde": { label: "Shelf check", ring: ["#8FD2A8", "#236044"], glow: "rgba(143,210,168,0.35)" },
  "m-ife": { label: "Just me", ring: ["#FFB088", "#8E4052"], glow: "rgba(255,176,136,0.35)" },
  "m-ken": { label: "Follow timeline", ring: ["#C9A227", "#3D0F15"], glow: "rgba(201,162,39,0.35)" },
  "m-lola": { label: "Evening routine", ring: ["#FF8BC8", "#5A2D82"], glow: "rgba(255,139,200,0.38)" },
};

export function storyMetaFor(id: string): StoryRailMeta {
  return (
    STORY_RAIL_META[id] ?? {
      label: "Story",
      ring: DEFAULT_RING,
      glow: "rgba(201,162,39,0.3)",
    }
  );
}

export const CREATE_UNMASK_RING = ["#FF6B9D", "#C94B8A"] as const;
export const CREATE_UNMASK_GLOW = "rgba(255,107,157,0.45)";
