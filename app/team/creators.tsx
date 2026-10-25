import { useState } from "react";
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
  const q = useQuery({ queryKey: ["team", "creators"], queryFn: api.creators });
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState("");
  return (
    <TeamPage title="Creators" tab="Operations">
      <Busy loading={q.isLoading} error={q.error} />
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
