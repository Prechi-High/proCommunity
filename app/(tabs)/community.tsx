import { lazy, Suspense } from "react";

import { AppShell, ContentSkeleton } from "@/components/unmask-ui";

const UpdatesFeed = lazy(() => import("@/components/social/UpdatesFeed").then((m) => ({ default: m.UpdatesFeed })));

export default function Updates() {
  return (
    <AppShell notify flush ambient="socialNight" title="Updates" subtitle="24-hour status and moment sections.">
      <Suspense fallback={<ContentSkeleton rows={8} />}>
        <UpdatesFeed />
      </Suspense>
    </AppShell>
  );
}