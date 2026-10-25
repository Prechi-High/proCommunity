import { useState } from "react";
import { Linking } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import { CreatorGate } from "@/components/creator/Gate";
import {
  Button,
  Busy,
  Card,
  Copy,
  Heading,
  Notice,
  Photo,
  Pill,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/creator/api";
export default function Assignment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <CreatorGate>
      <Detail key={id} id={id} />
    </CreatorGate>
  );
}
function Detail({ id }: { id: string }) {
  const uid = useAppStore((s) => s.profile!.id);
  const r = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const a = useQuery({
    queryKey: ["creator-assignment", id, uid],
    queryFn: () => api.assignment(id),
  });
  const brief = useQuery({
    queryKey: ["creator-brief", id, uid],
    queryFn: () => api.brief(id),
  });
  const materials = useQuery({
    queryKey: ["creator-materials", id, uid],
    queryFn: () => api.materials(id),
  });
  const draft = useQuery({
    queryKey: ["creator-draft", id, uid],
    queryFn: () => api.draft(id),
  });
  const change = async (p: Partial<api.Draft>) => {
    setBusy(true);
    setError("");
    try {
      await api.saveDraft(id, p);
      await qc.invalidateQueries({ queryKey: ["creator-draft", id, uid] });
      await qc.invalidateQueries({ queryKey: ["creator-drafts", uid] });
    } catch {
      setError("Could not save your checklist. Retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <UtilityPage title="Assignment detail" sub="PRIVATE CREATOR WORKSPACE">
      <Busy
        loading={a.isLoading}
        error={a.error}
        retry={() => void a.refetch()}
      />
      {a.data ? (
        <>
          <Card>
            <Photo uri={a.data.unmask_catalog?.image_url} size={130} />
            <Heading>{a.data.title}</Heading>
            <Copy>{a.data.unmask_catalog?.name}</Copy>
            <Pill>{a.data.status}</Pill>
            <Copy small>Assigned by Unmask Editorial.</Copy>
            <Busy
              loading={brief.isLoading}
              error={brief.error}
              retry={() => void brief.refetch()}
            />
            <Copy>Schedule: {brief.data?.due_on || "No date set"}</Copy>
          </Card>
          <Card>
            <Heading>Assignment scope</Heading>
            <Copy>
              {brief.data?.scope ||
                a.data.concern ||
                "Editorial has not added a scope yet."}
            </Copy>
          </Card>
          <Heading>Research materials</Heading>
          <Busy
            loading={materials.isLoading}
            error={materials.error}
            retry={() => void materials.refetch()}
          />
          {materials.data?.map((m) => (
            <Card key={m.id}>
              <Pill>{m.kind}</Pill>
              <Heading>{m.label}</Heading>
              <Copy>{m.body}</Copy>
              <Copy small>
                {m.permission_note ||
                  "Use only the approved material and confirm usage permissions."}
              </Copy>
              {m.url ? (
                <Button
                  quiet
                  label="Open source →"
                  onPress={() =>
                    void Linking.openURL(m.url!).catch(() =>
                      setError("Could not open source."),
                    )
                  }
                />
              ) : null}
            </Card>
          ))}
          {materials.data?.length === 0 ? (
            <Copy>No approved research materials have been attached yet.</Copy>
          ) : null}
          <Card>
            <Heading>Permissions</Heading>
            <Copy>
              {brief.data?.permissions ||
                "Use only approved excerpts. Do not expose private interview or account details."}
            </Copy>
            <Copy small>
              Keep community accounts, manufacturer statements and expert
              explanations clearly labelled.
            </Copy>
          </Card>
          <Button
            quiet
            label="Request a follow-up through Unmask"
            onPress={() => r.push(`/help?assignment=${id}` as Href)}
          />
          <Card>
            <Heading>Your checklist</Heading>
            <Busy
              loading={draft.isLoading}
              error={draft.error}
              retry={() => void draft.refetch()}
            />
            <Button
              quiet
              disabled={busy || draft.isLoading || draft.isError}
              label={`${draft.data?.accepted ? "✓" : "○"} Confirm availability`}
              onPress={() => void change({ accepted: !draft.data?.accepted })}
            />
            <Button
              quiet
              disabled={busy || draft.isLoading || draft.isError}
              label={`${draft.data?.brief_read ? "✓" : "○"} Review brief`}
              onPress={() =>
                void change({ brief_read: !draft.data?.brief_read })
              }
            />
            <Button
              quiet
              disabled={busy || draft.isLoading || draft.isError}
              label={`${draft.data?.narrative_ready ? "✓" : "○"} Draft narrative`}
              onPress={() =>
                void change({ narrative_ready: !draft.data?.narrative_ready })
              }
            />
            <Copy small>
              Upload and review status are recorded when you submit a video.
            </Copy>
          </Card>
          <Button
            label="Start submission →"
            onPress={() => r.push(`/creator/submit?id=${id}` as Href)}
          />
        </>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
    </UtilityPage>
  );
}
