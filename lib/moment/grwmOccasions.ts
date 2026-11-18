import type { Icon } from "phosphor-react-native";

import {
  Airplane,
  Briefcase,
  Camera,
  Coffee,
  Confetti,
  Diamond,
  ForkKnife,
  Handbag,
  Heart,
  Martini,
  Plus,
} from "@/components/icons";

export const GRWM_OCCASION_TILES: {
  id: string;
  Icon: Icon;
  lines: readonly string[];
  custom?: boolean;
}[] = [
  { id: "Date Night", Icon: Heart, lines: ["Date", "Night"] },
  { id: "Work", Icon: Briefcase, lines: ["Work"] as const },
  { id: "Girls' Night", Icon: Martini, lines: ["Girls'", "Night"] as const },
  { id: "Dinner", Icon: ForkKnife, lines: ["Dinner"] as const },
  { id: "Party", Icon: Confetti, lines: ["Party"] as const },
  { id: "Wedding", Icon: Diamond, lines: ["Wedding"] as const },
  { id: "Vacation", Icon: Airplane, lines: ["Vacation"] as const },
  { id: "Photoshoot", Icon: Camera, lines: ["Photo", "shoot"] as const },
  { id: "Going Out", Icon: Handbag, lines: ["Going", "Out"] as const },
  { id: "Casual Day", Icon: Coffee, lines: ["Casual", "Day"] as const },
  { id: "My Own", Icon: Plus, lines: ["My Own"], custom: true },
];

export type GrwmOccasionId = (typeof GRWM_OCCASION_TILES)[number]["id"];