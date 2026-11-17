import { lazy, Suspense } from "react";

import { AppShell, ContentSkeleton } from "@/components/unmask-ui";
import { VISION_SCREENS } from "@/lib/navigation/visionNav";

const UpdatesFeed = lazy(() => import("@/components/social/UpdatesFeed").then((m) => ({ default: m.UpdatesFeed })));

export default function UpdatesTab() {
  return (
    <AppShell notify flush ambient="socialNight" title={VISION_SCREENS.updates.title} subtitle={VISION_SCREENS.updates.subtitle}>
      <Suspense fallback={<ContentSkeleton rows={8} />}>
        <UpdatesFeed />
      </Suspense>
    </AppShell>
  );
}