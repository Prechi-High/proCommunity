import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Notice } from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/utilities/api";
export function BookmarkButton({
  kind,
  id,
}: {
  kind: "investigation" | "experience";
  id: string;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["bookmarks", uid],
    queryFn: api.bookmarks,
    enabled: !!uid,
  });
  const saved = q.data?.find(
    (b) =>
      (kind === "investigation" ? b.investigation_id : b.experience_id) === id,
  );
  return (
    <>
      <Button
        quiet
        label={saved ? "▣ Saved · remove" : "＋ Save for later"}
        disabled={busy || (!!uid && q.isLoading)}
        onPress={() => {
          if (!uid) {
            r.push("/(auth)/sign-in");
            return;
          }
          setBusy(true);
          setError("");
          void api
            .toggleBookmark(kind, id, saved?.id)
            .then(() => qc.invalidateQueries({ queryKey: ["bookmarks", uid] }))
            .catch(() =>
              setError("Could not update saved items. Please retry."),
            )
            .finally(() => setBusy(false));
        }}
      />
      {error || q.error ? (
        <Notice>{error || "Could not load saved items."}</Notice>
      ) : null}
    </>
  );
}
