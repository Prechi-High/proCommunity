import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import { Busy, Copy, Notice } from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import { membership } from "@/lib/creator/api";
export function CreatorGate({ children }: { children: ReactNode }) {
  const uid = useAppStore((s) => s.profile?.id);
  const q = useQuery({
    queryKey: ["creator-membership", uid],
    queryFn: membership,
    enabled: !!uid,
  });
  if (!uid)
    return (
      <UtilityPage title="Creator workspace">
        <SignInCard />
      </UtilityPage>
    );
  if (q.isLoading || q.error)
    return (
      <UtilityPage title="Creator workspace">
        <Busy
          loading={q.isLoading}
          error={q.error}
          retry={() => void q.refetch()}
        />
      </UtilityPage>
    );
  if (!q.data)
    return (
      <UtilityPage title="Creator workspace">
        <Notice>This private workspace is for assigned Unmask Creators.</Notice>
        <Copy>Your member account does not currently have creator access.</Copy>
      </UtilityPage>
    );
  return <>{children}</>;
}
