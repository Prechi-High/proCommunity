import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
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
  Pill,
} from "@/components/unmask/reference/ui";
import { db } from "@/lib/clarity/api";
import * as api from "@/lib/team/api";
export default function Research() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <TeamGate>
      <Content key={id || "pick"} initial={id} />
    </TeamGate>
  );
}
function Content({ initial }: { initial?: string }) {
  const [id, setId] = useState(initial || "");
  const [tab, setTab] = useState("Interviews");
  const [scope, setScope] = useState("");
  const [permissions, setPermissions] = useState("");
  const [due, setDue] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState("");
  const [recording, setRecording] = useState(false);
  const [approval, setApproval] = useState(false);
  const [kind, setKind] = useState("Community account");
  const [url, setUrl] = useState("");
  const [state, setState] = useState("Pending");
  const action = useTeamAction();
  const cases = useQuery({ queryKey: ["team", "cases"], queryFn: api.cases });
  const brief = useQuery({
    queryKey: ["team", "brief", id],
    queryFn: () => api.brief(id),
    enabled: !!id,
  });
  const entries = useQuery({
    queryKey: ["team", "research", id],
    queryFn: () => api.research(id),
    enabled: !!id,
  });
  const materials = useQuery({
    queryKey: ["team", "materials", id],
    queryFn: () => api.materials(id),
    enabled: !!id,
  });
  useEffect(() => {
    setScope(brief.data?.scope || "");
    setPermissions(brief.data?.permissions || "");
    setDue(brief.data?.due_on || "");
  }, [brief.data, id]);
  return (
    <TeamPage title="Research workspace" tab="Research">
      {!id ? (
        <>
          <Copy>Select a case</Copy>
          <Busy loading={cases.isLoading} error={cases.error} />
          {cases.data?.map((c) => (
            <Button
              quiet
              key={c.id}
              label={c.title}
              onPress={() => setId(c.id)}
            />
          ))}
        </>
      ) : (
        <>
          <Heading>
            {cases.data?.find((c) => c.id === id)?.title || "Case"}
          </Heading>
          <Button quiet label="Choose another case" onPress={() => setId("")} />
          <Card>
            <Heading>Creator brief</Heading>
            <Busy loading={brief.isLoading} error={brief.error} />
            <Field label="Scope" multiline value={scope} onChange={setScope} />
            <Field
              label="Usage permissions"
              multiline
              value={permissions}
              onChange={setPermissions}
            />
            <Field
              label="Due date (YYYY-MM-DD, optional)"
              value={due}
              onChange={setDue}
            />
            <Button
              disabled={action.isPending}
              label="Save brief"
              onPress={() =>
                action.mutate(() =>
                  api.read(
                    db()
                      .from("unmask_creator_briefs")
                      .upsert({
                        investigation_id: id,
                        scope,
                        permissions,
                        due_on: due || null,
                      }),
                  ),
                )
              }
            />
          </Card>
          <Chips
            options={["Interviews", "Sources", "Outreach", "Permissions"]}
            value={tab}
            onChange={setTab}
          />
          <Busy
            loading={entries.isLoading || materials.isLoading}
            error={entries.error || materials.error}
          />
          {tab === "Sources"
            ? materials.data?.map((m) => (
                <Card key={m.id}>
                  <Pill>
                    {m.approved ? "Approved for creator" : "Team only"}
                  </Pill>
                  <Heading>{m.label}</Heading>
                  <Copy>{m.kind}</Copy>
                  <Copy>{m.body}</Copy>
                  <Copy small>{m.permission_note}</Copy>
                  <Button
                    quiet
                    disabled={
                      action.isPending ||
                      (!m.approved && m.permission_note.trim().length < 5)
                    }
                    label={
                      m.approved
                        ? "Withdraw creator access"
                        : "Approve for creator access"
                    }
                    onPress={() =>
                      action.mutate(() =>
                        api.read(
                          db()
                            .from("unmask_creator_materials")
                            .update({ approved: !m.approved })
                            .eq("id", m.id),
                        ),
                      )
                    }
                  />
                </Card>
              ))
            : entries.data
                ?.filter(
                  (e) =>
                    e.kind ===
                    (tab === "Interviews"
                      ? "Interview"
                      : tab === "Outreach"
                        ? "Outreach"
                        : "Permission"),
                )
                .map((e) => (
                  <Card key={e.id}>
                    <Heading>{e.label}</Heading>
                    <Pill>{e.status}</Pill>
                    <Copy>{e.notes}</Copy>
                    {e.scheduled_at ? (
                      <Copy>
                        {new Date(e.scheduled_at).toLocaleString("en-NG", {
                          timeZone: "Africa/Lagos",
                        })}
                      </Copy>
                    ) : null}
                    <Copy small>
                      Recording consent:{" "}
                      {e.recording_consent ? "Recorded" : "Pending"} ·
                      Publication permission:{" "}
                      {e.publication_approved ? "Recorded" : "Pending"}
                    </Copy>
                  </Card>
                ))}
          <Card>
            <Heading>
              {tab === "Sources"
                ? "Add creator research material"
                : "Add a private team record"}
            </Heading>
            <Field
              label="Label / participant name"
              value={label}
              onChange={setLabel}
            />
            <Field
              label={
                tab === "Sources"
                  ? "Approved excerpt or source summary"
                  : "Private research notes"
              }
              multiline
              value={notes}
              onChange={setNotes}
            />
            {tab === "Sources" ? (
              <>
                <Chips
                  options={[
                    "Community account",
                    "Manufacturer statement",
                    "Expert explanation",
                  ]}
                  value={kind}
                  onChange={setKind}
                />
                <Field
                  label="Source HTTPS URL (optional)"
                  value={url}
                  onChange={setUrl}
                />
                <Copy>Permission note</Copy>
                <Field
                  label="What may the creator use?"
                  value={permissions}
                  onChange={setPermissions}
                />
              </>
            ) : (
              <>
                <Field
                  label="Scheduled time, YYYY-MM-DDTHH:mm (Lagos, optional)"
                  value={when}
                  onChange={setWhen}
                />
                <Chips
                  options={[
                    "Pending",
                    "Scheduled",
                    "Awaiting response",
                    "Responded",
                    "Complete",
                  ]}
                  value={state}
                  onChange={setState}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Copy>Recording consent recorded</Copy>
                  <Switch
                    value={recording}
                    onValueChange={setRecording}
                    accessibilityLabel="Recording consent recorded"
                  />
                </View>
              </>
            )}
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Copy>
                {tab === "Sources"
                  ? "Approved for creator access"
                  : "Publication excerpt approved"}
              </Copy>
              <Switch
                value={approval}
                onValueChange={setApproval}
                accessibilityLabel="Publication excerpt approved"
              />
            </View>
            <Button
              disabled={
                action.isPending ||
                label.trim().length < 2 ||
                (tab === "Sources" && approval && permissions.trim().length < 5)
              }
              label={
                tab === "Sources"
                  ? "Save source material"
                  : "Record research activity"
              }
              onPress={() =>
                action.mutate(async () => {
                  if (tab === "Sources")
                    await api.read(
                      db()
                        .from("unmask_creator_materials")
                        .insert({
                          investigation_id: id,
                          label: label.trim(),
                          kind,
                          body: notes,
                          url: url || null,
                          permission_note: permissions,
                          approved: approval,
                        }),
                    );
                  else
                    await api.read(
                      db()
                        .from("unmask_team_research")
                        .insert({
                          investigation_id: id,
                          kind:
                            tab === "Interviews"
                              ? "Interview"
                              : tab === "Outreach"
                                ? "Outreach"
                                : "Permission",
                          label: label.trim(),
                          notes,
                          scheduled_at: api.dateTime(when),
                          status: state,
                          recording_consent: recording,
                          publication_approved: approval,
                        }),
                    );
                  setLabel("");
                  setNotes("");
                })
              }
            />
            <Copy small>
              Records schedules and contact history only; it does not send
              invitations or contact anyone. Raw team notes are never shared
              with creators.
            </Copy>
          </Card>
          <Copy>
            Only explicitly approved materials are visible in the creator
            workspace.
          </Copy>
          <ActionResult action={action} />
        </>
      )}
    </TeamPage>
  );
}
