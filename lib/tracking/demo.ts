import { SAMPLE_SHELF, SAMPLE_FEED } from "@/lib/unmask/samples";
import type { TrackedJourney, UsageUpdate } from "./api";
export function demoJournal(id: string) {
  const p = SAMPLE_SHELF.find((x) => x.id === id);
  if (!p) return null;
  const story = SAMPLE_FEED.find(
    (x) => x.productId === id && x.kind === "experience",
  );
  const j: TrackedJourney = {
    id,
    user_id: "demo-member",
    product_id: id,
    status: "active",
    acquisition: "purchased",
    started_on: null,
    stopped_on: null,
    frequency: "Once a day · evening",
    goal: null,
    context: null,
    stop_reason: null,
    replacement_id: null,
    visibility: "private",
    created_at: new Date(Date.now() - 42 * 86400000).toISOString(),
    usage_duration: "Week 6",
    skin_type: "Dry",
    ownership_verified: false,
    unmask_catalog: {
      id,
      name: p.name,
      brand: p.brand,
      category: "Skincare",
      image_url: p.image,
      company_id: null,
    },
  };
  const updates: UsageUpdate[] = [
    [
      "Week 1",
      "I started using a small amount in the evening. Keeping this note as my starting point.",
    ],
    [
      "Week 3",
      "My routine is still once each evening. I’m noting the feel of my skin, without changing several products at once.",
    ],
    [
      "Week 6",
      story?.body || "I’m still using it and keeping a record of how it feels.",
    ],
  ].map(([duration, changed], i) => ({
    id: `${id}-${i}`,
    journey_id: id,
    changed,
    usage_duration: duration,
    skin_type: "Dry",
    frequency_snapshot: "Once a day · evening",
    status_snapshot: "active",
    photo_path: null,
    visibility: "private",
    created_at: new Date(Date.now() - (42 - i * 21) * 86400000).toISOString(),
  }));
  return { journey: j, updates };
}
