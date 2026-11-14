import { Drop, Eyedropper, HandHeart, MoonStars, Package, Sun, TShirt, UserCircle } from "@/components/icons";

const MAP = {
  Skincare: Drop,
  Makeup: Eyedropper,
  Hair: HandHeart,
  Body: UserCircle,
  "Self-care": MoonStars,
  Outfit: TShirt,
  "Morning routine": Sun,
  Shelfie: Package,
  "Holding product": Package,
  "In use": Drop,
} as const;

export function routineIconFor(label: string) {
  return (MAP as Record<string, typeof Drop>)[label] ?? Package;
}