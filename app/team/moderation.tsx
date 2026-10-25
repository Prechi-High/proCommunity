import { useState } from "react";
import { Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  TeamGate,
  TeamPage,
  useTeamAction,
  ActionResult,
} from "@/components/team/Page";
import { Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import { db } from "@/lib/clarity/api";
import * as api from "@/lib/team/api";
export default function Moderation() {
  return (
    <TeamGate>
      <Content />
    </TeamGate>
  );
}
function Content() {
  const [tab, setTab] = useState("open");
  const q = useQuery({ queryKey: ["team", "reports"], queryFn: api.reports });
  return (
    <TeamPage title="Content moderation" tab="Operations">
      <Heading>Keep the conversation useful.</Heading>
      <Copy>
        Review reports in context. Criticism alone is not a policy violation.
      </Copy>
      <Chips
        options={["open", "in_review", "resolved"]}
        value={tab}
        onChange={setTab}
      />
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data
        ?.filter((r) => r.status === tab)
        .map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      {q.data?.filter((r) => r.status === tab).length === 0 ? (
        <Copy>No reports in this view.</Copy>
      ) : null}
    </TeamPage>
  );
}
function ReportCard({ report: r }: { report: api.Report }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const action = useTeamAction();
  const table =
    r.target_kind === "experience"
      ? "clarity_experiences"
      : r.target_kind === "reply"
        ? "clarity_experience_replies"
        : "unmask_questions";
  const content = useQuery({
    queryKey: ["team", "reported-content", r.target_kind, r.target_id],
    queryFn: () =>
      api.read<{ body: string } | null>(
        db().from(table).select("body").eq("id", r.target_id).maybeSingle(),
      ),
  });
  return (
    <Card>
      <Pill>Reported {r.target_kind}</Pill>
      <Copy small>Report: {r.id}</Copy>
      <Busy loading={content.isLoading} error={content.error} />
      <Copy>
        {content.data?.body || "Content is unavailable or no longer visible."}
      </Copy>
      <Heading>Reporter claim</Heading>
      <Copy>{r.reason}</Copy>
      <Notice>
        Unfavorable product experiences are allowed. Decide using evidence and
        policy, not sponsor preference.
      </Notice>
      {r.status === "resolved" ? (
        <>
          <Pill>{r.decision}</Pill>
          <Copy>{r.decision_reason}</Copy>
        </>
      ) : (
        <>
          <Field
            label="Decision reason (required)"
            multiline
            value={reason}
            onChange={setReason}
          />
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Copy>Notify author in-app</Copy>
            <Switch
              value={notify}
              onValueChange={setNotify}
              accessibilityLabel="Notify author in-app"
            />
          </View>
          <Button
            disabled={action.isPending || reason.trim().length < 10}
            label="Keep content"
            onPress={() =>
              action.mutate(() => api.moderate(r.id, "keep", reason, notify))
            }
          />
          <Button
            quiet
            disabled={action.isPending || reason.trim().length < 10}
            label="Request clarification"
            onPress={() =>
              action.mutate(() => api.moderate(r.id, "clarify", reason, notify))
            }
          />
          <Button
            quiet
            disabled={action.isPending || reason.trim().length < 10}
            label="Remove for policy violation"
            onPress={() => setConfirm(true)}
          />
          {confirm ? (
            <>
              <Copy>
                This hides the content publicly and records the reason. It does
                not delete the original.
              </Copy>
              <Button
                disabled={action.isPending}
                label="Confirm removal"
                onPress={() =>
                  action.mutate(() =>
                    api.moderate(r.id, "remove", reason, notify),
                  )
                }
              />
              <Button quiet label="Cancel" onPress={() => setConfirm(false)} />
            </>
          ) : null}
        </>
      )}
      <ActionResult action={action} />
    </Card>
  );
}
