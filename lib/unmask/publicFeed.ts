import { features } from "@/lib/features";
import type { FeedItem } from "./feed";

/** Hide paused layers from lists while keeping backend data intact. */
export function feedForRelease(items: FeedItem[]): FeedItem[] {
  if (features.ultraUnmask) return items;
  return items.filter((item) => item.kind !== "unmask");
}
