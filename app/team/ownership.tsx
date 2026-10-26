import { useState } from "react";
import { Image, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TeamGate, TeamPage } from "@/components/team/Page";
import { ActionButton, StatusMessage } from "@/components/unmask-ui";
import { db } from "@/lib/clarity/api";
import { Label, Note } from "@/components/tracking/Fields";
export default function OwnershipReview() {
  return (
    <TeamGate>
      <Review />
    </TeamGate>
  );
}
function Review() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const q = useQuery({
    queryKey: ["ownership-review"],
    queryFn: async () => {
      const { data, error } = await db()
        .from("unmask_ownership_proofs")
        .select("id,journey_id,photo_path,status,created_at")
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  async function review(id: string, status: string) {
    setPending(id);
    setError("");
    try {
      const { data, error } = await db()
        .from("unmask_ownership_proofs")
        .update({ status })
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["ownership-review"] });
    } catch {
      setError("Only an administrator can approve or reject ownership proof.");
    } finally {
      setPending("");
    }
  }
  return (
    <TeamPage title="Ownership proof review" tab="Operations">
      <Note>
        Review only product ownership. This does not verify a product’s safety
        or a user’s opinion. Proof images stay private to their owner and
        reviewers.
      </Note>
      {error ? <StatusMessage kind="error" title={error} /> : null}
      {q.isError ? (
        <ActionButton
          label="Retry ownership submissions"
          onPress={() => void q.refetch()}
        />
      ) : null}
      {q.data?.map((p) => (
        <View
          key={p.id}
          style={{
            gap: 12,
            padding: 18,
            borderWidth: 1,
            borderColor: "#DDD",
            borderRadius: 18,
          }}
        >
          <Label>Product ownership submission</Label>
          <Note>{new Date(p.created_at).toLocaleDateString()}</Note>
          <ProofPhoto path={p.photo_path} />
          <ActionButton
            label="Verify ownership"
            pending={pending === p.id}
            onPress={() => void review(p.id, "verified")}
          />
          <ActionButton
            tone="secondary"
            label="Request a clearer photo (reject)"
            disabled={!!pending}
            onPress={() => void review(p.id, "rejected")}
          />
        </View>
      ))}
      {q.isSuccess && !q.data.length ? (
        <Note>No pending ownership submissions.</Note>
      ) : null}
    </TeamPage>
  );
}
function ProofPhoto({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["ownership-review-photo", path],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await db()
        .storage.from("ownership-proofs")
        .createSignedUrl(path, 180);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return (
    <>
      {q.data ? (
        <Image
          source={{ uri: q.data }}
          style={{ width: "100%", height: 220 }}
          resizeMode="contain"
        />
      ) : (
        <ActionButton
          tone="secondary"
          label="Open private proof photo"
          onPress={() => setOpen(true)}
        />
      )}
      {q.isError ? <Note>The proof photo is unavailable.</Note> : null}
    </>
  );
}
