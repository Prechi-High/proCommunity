import { ChatCircle, Clock, House, MagnifyingGlass, Sparkle, User } from "@/components/icons";

type NavIcon = typeof House;

/** Bottom nav aligned to Complete App Vision batches 1–6. */
export type VisionNavItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  Icon: NavIcon;
  fab?: boolean;
};

export const VISION_NAV: VisionNavItem[] = [
  {
    id: "home",
    label: "Home",
    detail: "For you — stories & experience posts",
    href: "/",
    Icon: House,
  },
  {
    id: "moments",
    label: "Moments",
    detail: "GRWM, morning, evening, currently using",
    href: "/moments",
    Icon: Sparkle,
  },
  {
    id: "search",
    label: "Search",
    detail: "Ask before you buy — find a product",
    href: "/results",
    Icon: MagnifyingGlass,
    fab: true,
  },
  {
    id: "community",
    label: "Community",
    detail: "Questions people ask before they buy",
    href: "/community",
    Icon: ChatCircle,
  },
  {
    id: "updates",
    label: "Updates",
    detail: "24-hour status & what's happening",
    href: "/updates",
    Icon: Clock,
  },
  {
    id: "profile",
    label: "My Unmask",
    detail: "Your identity, products & journeys",
    href: "/you",
    Icon: User,
  },
];

export const VISION_SCREENS = {
  home: {
    title: "Home",
    subtitle: "Real people. Real routines. Real products.",
  },
  moments: {
    title: "Unmask Moments",
    subtitle: "Capture a beat — story only, gone in 24 hours.",
  },
  search: {
    title: "Know before you buy",
    subtitle: "Search products. See lived experiences and questions.",
  },
  community: {
    title: "Community",
    subtitle: "Ask real questions. Read answers from people who tried it.",
  },
  updates: {
    title: "Updates",
    subtitle: "Status & moment sections — refreshed every day.",
  },
  myUnmask: {
    title: "My Unmask",
    subtitle: "This is me. This is what I use. This is what happened.",
  },
} as const;

export function navActive(path: string, href: string): boolean {
  const p = path.replace(/\/\([^/]+\)/g, "").replace(/\/index$/, "/") || "/";
  if (href === "/") return p === "/" || p === "";
  if (href === "/community") {
    return (
      p.startsWith("/community") ||
      p.startsWith("/question") ||
      p.startsWith("/thread") ||
      p.startsWith("/ask-community")
    );
  }
  if (href === "/updates") {
    return p.startsWith("/updates") || p.startsWith("/story");
  }
  if (href === "/moments") return p.startsWith("/moments") || p.startsWith("/moment");
  if (href === "/you") {
    return (
      p.startsWith("/you") ||
      p.startsWith("/profile") ||
      p.startsWith("/journey") ||
      p.startsWith("/products")
    );
  }
  return p.startsWith(href);
}