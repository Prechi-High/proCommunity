import type { RecordingCopy, RoomProductChip } from "./types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function roomProducts(metadata: unknown): RoomProductChip[] {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const found: RoomProductChip[] = [];
  const push = (item: RoomProductChip) => {
    const name = item.name.trim();
    if (!name) return;
    const existing = found.find((chip) => chip.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!existing.id && item.id) existing.id = item.id;
      if (!existing.brand && item.brand) existing.brand = item.brand.slice(0, 40);
      return;
    }
    found.push({ id: item.id, name: name.slice(0, 80), brand: item.brand?.slice(0, 40) });
  };

  if (Array.isArray(meta.products)) {
    for (const entry of meta.products) {
      if (typeof entry === "string") {
        push({ name: entry });
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      push({
        id: text(row.id) || text(row.product_id) || undefined,
        name: text(row.name) || text(row.product_name),
        brand: text(row.brand) || undefined,
      });
    }
  }

  push({
    id: text(meta.product_id) || undefined,
    name: text(meta.product_name),
    brand: text(meta.product_brand) || text(meta.brand) || undefined,
  });

  return found.slice(0, 3);
}

export function roomTopic(metadata: unknown) {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  return text(meta.topic).slice(0, 60);
}

export function recordingCopy(status?: string | null): RecordingCopy {
  switch (status) {
    case "recording":
      return { label: "Recording", active: true, failed: false };
    case "processing":
      return { label: "Saving recording", active: true, failed: false };
    case "ready":
      return { label: "Recorded", active: false, failed: false };
    case "failed":
      return { label: "Recording failed", active: false, failed: true };
    case "pending":
      return { label: "Recording queued", active: false, failed: false };
    default:
      return { label: "Not recording", active: false, failed: false };
  }
}

export function formatSchedule(iso?: string | null) {
  if (!iso) return "Time to be announced";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Time to be announced";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function peopleLabel(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`;
}
