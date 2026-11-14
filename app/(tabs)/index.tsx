import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";

import { SocialHome } from "@/components/social/SocialHome";
import { AppShell, Skeleton } from "@/components/unmask-ui";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const r = useRouter();
  const path = usePathname();
  const profile = useAppStore((s) => s.profile);
  const uid = profile?.id;
  const home = path === "/" || path === "/index" || path.endsWith("/index");
  useEffect(() => {
    if (!uid && home) r.replace("/welcome");
  }, [uid, r, home]);
  if (!uid) return <AppShell notify><Skeleton height={250} /></AppShell>;
  return (
    <AppShell
      notify
      flush
      ambient="socialNight"
      brandSubtitle="Real People. Real Routines. Real Products."
      homeProfile={profile ? { id: profile.id, name: profile.displayName } : undefined}
    >
      <SocialHome />
    </AppShell>
  );
}
