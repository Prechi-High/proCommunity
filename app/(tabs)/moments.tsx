import { useRouter, type Href } from "expo-router";

import { ChooseMoment } from "@/components/moment/ChooseMoment";
import { useAppStore } from "@/lib/store";
import type { MomentKind } from "@/lib/moment/kinds";

/** Tab entry for Batch 2 — same chooser as /moment, then full capture flow. */
export default function MomentsTab() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);

  const onPick = (kind: MomentKind) => {
    if (!uid) {
      router.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/moment" } } as Href);
      return;
    }
    router.push({ pathname: "/moment", params: { kind } } as Href);
  };

  return <ChooseMoment onPick={onPick} />;
}