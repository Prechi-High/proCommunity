import { useState } from "react";
import { useRouter } from "expo-router";
import { Button, Card, Copy, Notice } from "@/components/unmask/reference/ui";
import { Field } from "@/components/community-v2/ui";
import { useAppStore } from "@/lib/store";
import { reportContent } from "@/lib/team/api";
export function ReportButton({
  kind,
  id,
}: {
  kind: "experience" | "reply" | "question";
  id: string;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <>
      <Button
        quiet
        label="Report content"
        onPress={() => (uid ? setOpen(!open) : r.push("/(auth)/sign-in"))}
      />
      {open ? (
        <Card>
          <Copy>
            Report a specific policy concern. Negative product experiences are
            allowed.
          </Copy>
          <Field
            label="Reason (10–1000 characters)"
            value={reason}
            onChange={setReason}
            multiline
          />
          <Button
            disabled={busy || reason.trim().length < 10 || reason.length > 1000}
            label={busy ? "Saving report…" : "Submit private report"}
            onPress={() => {
              setBusy(true);
              void reportContent(kind, id, reason.trim())
                .then(() => {
                  setNotice("Report saved for team review.");
                  setOpen(false);
                  setReason("");
                })
                .catch((e) =>
                  setNotice(
                    e instanceof Error && e.message.includes("duplicate")
                      ? "You have already reported this content."
                      : "Could not save the report. Please retry.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          />
        </Card>
      ) : null}
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}
