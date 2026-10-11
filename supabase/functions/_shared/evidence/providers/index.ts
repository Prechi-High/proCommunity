export * from "./types.ts";
export * from "./config.ts";
export { youtubeProvider } from "./youtube.ts";
export { redditProvider } from "./reddit.ts";
export { xProvider } from "./x.ts";
export { discourseProvider } from "./discourse.ts";
export { githubProvider } from "./github.ts";
export { hackernewsProvider } from "./hackernews.ts";
export { webEvidenceProvider } from "./web.ts";
export { providerRouteOrder } from "./routing.ts";

import { discourseProvider } from "./discourse.ts";
import { githubProvider } from "./github.ts";
import { hackernewsProvider } from "./hackernews.ts";
import { redditProvider } from "./reddit.ts";
import { webEvidenceProvider } from "./web.ts";
import { xProvider } from "./x.ts";
import { youtubeProvider } from "./youtube.ts";
import type { EvidenceProvider } from "./types.ts";

export const ALL_EVIDENCE_PROVIDERS: EvidenceProvider[] = [
  youtubeProvider,
  redditProvider,
  xProvider,
  discourseProvider,
  githubProvider,
  hackernewsProvider,
  webEvidenceProvider,
];

export function providerById(id: string): EvidenceProvider | undefined {
  return ALL_EVIDENCE_PROVIDERS.find((p) => p.id === id);
}
