import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";

import { MemberHome } from "@/components/movement/MemberHome";
import { AppShell, Skeleton } from "@/components/unmask-ui";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const r = useRouter();
  const path = usePathname();
  const uid = useAppStore((s) => s.profile?.id);
  const home = path === "/" || path === "/index" || path.endsWith("/index");
  useEffect(() => {
    if (!uid && home) r.replace("/welcome");
  }, [uid, r, home]);
  if (!uid) return <AppShell notify><Skeleton height={250} /></AppShell>;
  return (
    <AppShell notify>
      <MemberHome />
    </AppShell>
  );
}
