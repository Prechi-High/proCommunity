import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TeamGate,
  TeamPage,
  useTeamAction,
  ActionResult,
} from "@/components/team/Page";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Pill,
} from "@/components/unmask/reference/ui";
import { db } from "@/lib/clarity/api";
import * as api from "@/lib/team/api";
export default function Support() {
  return (
    <TeamGate>
      <Content />
    </TeamGate>
  );
}
function Content() {
  const [tab, setTab] = useState("open");
  const q = useQuery({ queryKey: ["team", "support"], queryFn: api.tickets });
  const action = useTeamAction();
  return (
    <TeamPage title="Support requests" tab="Operations">
      <Chips options={["open", "resolved"]} value={tab} onChange={setTab} />
      <Busy loading={q.isLoading} error={q.error} />
      {q.data
        ?.filter((t) => t.status === tab)
        .map((t) => (
          <Card key={t.id}>
            <Heading>{t.subject}</Heading>
            <Pill>{t.status}</Pill>
            <Copy>{t.message}</Copy>
            <Copy small>
              Ticket: {t.id} · Reference: {t.reference || "None"}
            </Copy>
            {t.status === "open" ? (
              <Button
                disabled={action.isPending}
                label="Mark resolved"
                onPress={() =>
                  action.mutate(() =>
                    api.read(
                      db()
                        .from("unmask_support_requests")
                        .update({ status: "resolved" })
                        .eq("id", t.id),
                    ),
                  )
                }
              />
            ) : null}
          </Card>
        ))}
      {q.data?.filter((t) => t.status === tab).length === 0 ? (
        <Copy>No support requests in this view.</Copy>
      ) : null}
      <ActionResult action={action} />
    </TeamPage>
  );
}
