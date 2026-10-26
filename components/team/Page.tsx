import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  Header,
  Heading,
  Copy,
  Chips,
  Button,
  Busy,
  Notice,
  s,
} from "@/components/unmask/reference/ui";
import { SignInCard } from "@/components/utilities/Page";
import { useAppStore } from "@/lib/store";
import { access } from "@/lib/team/api";
export function TeamGate({ children }: { children: ReactNode }) {
  const uid = useAppStore((s) => s.profile?.id);
  const q = useQuery({
    queryKey: ["team-access", uid],
    queryFn: access,
    enabled: !!uid,
  });
  if (!uid)
    return (
      <TeamFrame title="Private team workspace">
        <SignInCard />
      </TeamFrame>
    );
  if (q.isLoading || q.error)
    return (
      <TeamFrame title="Private team workspace">
        <Busy
          loading={q.isLoading}
          error={q.error}
          retry={() => void q.refetch()}
        />
      </TeamFrame>
    );
  if (!q.data)
    return (
      <TeamFrame title="Private team workspace">
        <Notice>Administrator access is required.</Notice>
      </TeamFrame>
    );
  return <>{children}</>;
}
function TeamFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const r = useRouter();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Header onBack={() => (r.canGoBack() ? r.back() : r.replace("/you"))} />
        <Copy small>PRIVATE TEAM WORKSPACE</Copy>
        <Heading hero>{title}</Heading>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function TeamPage({
  title,
  tab,
  children,
}: {
  title: string;
  tab: "Queue" | "Research" | "Review" | "Operations";
  children: ReactNode;
}) {
  const r = useRouter();
  return (
    <TeamFrame title={title}>
      <Chips
        options={["Queue", "Research", "Review", "Operations"]}
        value={tab}
        onChange={(t) =>
          r.push(
            (
              {
                Queue: "/team",
                Research: "/team/research",
                Review: "/team/review",
                Operations: "/team/finance",
              } as Record<string, string>
            )[t] as Href,
          )
        }
      />
      {tab === "Operations" ? (
        <Chips
          options={[
            "Moderation",
            "Ownership",
            "Partnerships",
            "Finance",
            "Support",
            "Creators",
          ]}
          value={
            title.includes("Ownership")
              ? "Ownership"
              : title.includes("partnership")
                ? "Partnerships"
                : title.includes("moderation")
                  ? "Moderation"
                  : title.includes("Support")
                    ? "Support"
                    : title.includes("Creators")
                      ? "Creators"
                      : "Finance"
          }
          onChange={(t) =>
            r.push(
              `/team/${({ Ownership: "ownership", Moderation: "moderation", Partnerships: "partnerships", Finance: "finance", Support: "support", Creators: "creators" } as Record<string, string>)[t]}` as Href,
            )
          }
        />
      ) : null}
      {children}
      <Button
        quiet
        label="Earlier admin tools"
        onPress={() => r.push("/admin/legacy" as Href)}
      />
    </TeamFrame>
  );
}
export function useTeamAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["team"] }),
        qc.invalidateQueries({ queryKey: ["offers"] }),
        qc.invalidateQueries({ queryKey: ["creator-reviews"] }),
        qc.invalidateQueries({ queryKey: ["creator-assignments"] }),
        qc.invalidateQueries({ queryKey: ["creator-earnings"] }),
        qc.invalidateQueries({ queryKey: ["creator-payouts"] }),
        qc.invalidateQueries({ queryKey: ["creator-materials"] }),
        qc.invalidateQueries({ queryKey: ["creator-brief"] }),
        qc.invalidateQueries({ queryKey: ["investigation-browse"] }),
        qc.invalidateQueries({ queryKey: ["today-requests"] }),
      ]);
    },
  });
}
export function ActionResult({
  action,
}: {
  action: ReturnType<typeof useTeamAction>;
}) {
  return (
    <>
      {action.isPending ? <Copy>Saving…</Copy> : null}
      {action.error ? <Notice>{action.error.message}</Notice> : null}
      {action.isSuccess ? <Notice>Saved.</Notice> : null}
    </>
  );
}
