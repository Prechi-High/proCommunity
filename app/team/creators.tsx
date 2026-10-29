import { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Copy,
  Heading,
  Pill,
} from "@/components/unmask/reference/ui";
import { db } from "@/lib/clarity/api";
import * as api from "@/lib/team/api";
export default function Creators() {
  return (
    <TeamGate>
      <Content />
    </TeamGate>
  );
}
function Content() {
  const action = useTeamAction();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["team", "creators"], queryFn: api.creators });
  const applications = useQuery({ queryKey: ["team", "creator-applications"], queryFn: async () => api.read(db().from("unmask_creator_applications").select("*").eq("status", "pending").order("created_at", { ascending: true })) });
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState("");
  return (
    <TeamPage title="Creators" tab="Operations">
      <Busy loading={q.isLoading} error={q.error} />
      <Card>
        <Heading>Creator applications</Heading>
        <Busy loading={applications.isLoading} error={applications.error} />
        {(applications.data || []).map((app: any) => (
          <View key={app.id} style={{ gap: 8, paddingTop: 10 }}>
            <Heading>{app.display_name}</Heading>
            <Copy>@{app.handle}</Copy>
            <Copy>{app.bio || "No bio yet."}</Copy>
            <Copy small>{(app.specialties || []).join(" · ") || "No specialties listed"}</Copy>
            {app.reason ? <Copy small>{app.reason}</Copy> : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                disabled={action.isPending}
                label="Approve + create creator"
                onPress={() => action.mutate(async () => {
                  const { error } = await db().from("unmask_creators").insert({
                    user_id: app.user_id,
                    display_name: app.display_name,
                    handle: app.handle,
                    bio: app.bio,
                    specialties: app.specialties,
                    published: false,
                    status: "trial",
                    verification_level: "creator",
                    credential_status: "unverified",
                  });
                  if (error) throw error;
                  const { error: updateError } = await db().from("unmask_creator_applications").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", app.id);
                  if (updateError) throw updateError;
                  await qc.invalidateQueries({ queryKey: ["team", "creators"] });
                  await qc.invalidateQueries({ queryKey: ["team", "creator-applications"] });
                })}
              />
              <Button
                quiet
                disabled={action.isPending}
                label="Reject"
                onPress={() => action.mutate(async () => {
                  const { error } = await db().from("unmask_creator_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", app.id);
                  if (error) throw error;
                  await qc.invalidateQueries({ queryKey: ["team", "creator-applications"] });
                })}
              />
            </View>
          </View>
        ))}
        {applications.data?.length === 0 ? <Copy muted>No pending applications.</Copy> : null}
      </Card>
      {q.data?.map((c) => (
        <Card key={c.user_id}>
          <Heading>{c.display_name}</Heading>
          <Copy>@{c.handle}</Copy>
          <Pill>{c.published ? "Public profile" : "Unpublished creator"}</Pill>
          <Button
            quiet
            disabled={action.isPending}
            label={
              c.published
                ? "Unpublish public creator profile"
                : "Publish creator profile"
            }
            onPress={() =>
              action.mutate(() =>
                api.read(
                  db()
                    .from("unmask_creators")
                    .update({ published: !c.published })
                    .eq("user_id", c.user_id),
                ),
              )
            }
          />
        </Card>
      ))}
      <Card>
        <Heading>Add an existing member as a creator</Heading>
        <Field label="Existing account UUID" value={id} onChange={setId} />
        <Field label="Display name" value={name} onChange={setName} />
        <Field label="Handle" value={handle} onChange={setHandle} />
        <Field label="Bio" multiline value={bio} onChange={setBio} />
        <Field
          label="Specialties, comma separated"
          value={specialties}
          onChange={setSpecialties}
        />
        <Button
          disabled={
            action.isPending ||
            !/^[0-9a-f-]{36}$/i.test(id) ||
            name.trim().length < 2 ||
            !/^\w{3,24}$/.test(handle)
          }
          label="Create unpublished creator profile"
          onPress={() =>
            action.mutate(() =>
              api.read(
                db()
                  .from("unmask_creators")
                  .insert({
                    user_id: id,
                    display_name: name.trim(),
                    handle: handle.toLowerCase(),
                    bio,
                    specialties: specialties
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    published: false,
                  }),
              ),
            )
          }
        />
        <Copy small>
          This grants creator workspace membership, not administrator access.
          Publishing a creator label does not verify professional credentials.
        </Copy>
      </Card>
      <ActionResult action={action} />
    </TeamPage>
  );
}
