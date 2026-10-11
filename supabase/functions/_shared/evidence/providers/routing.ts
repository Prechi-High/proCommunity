import type { IntelligenceDomain } from "../../blueprint/types.ts";
import type { ProviderId } from "./types.ts";

export function providerRouteOrder(domain: IntelligenceDomain | "inferred"): ProviderId[] {
  if (domain === "tech" || domain === "inferred") {
    return ["youtube", "reddit", "x", "discourse", "github", "hackernews", "web"];
  }
  if (domain === "beauty") {
    return ["youtube", "reddit", "x", "web"];
  }
  return ["youtube", "reddit", "discourse", "x", "web"];
}
