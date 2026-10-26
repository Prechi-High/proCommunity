import { Switch, View } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { db } from "@/lib/clarity/api";
import { ContentSkeleton, StatusMessage } from "@/components/unmask-ui";
import { Label, Note } from "@/components/tracking/Fields";
export function QuestionInvitePreference() {
  const uid = useAppStore((s) => s.profile?.id);
  const qc = useQueryClient();
  const key = ["question-invites", uid];
  const q = useQuery({
    queryKey: key,
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await db()
        .from("clarity_preferences")
        .select("product_question_invites")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data?.product_question_invites ?? true;
    },
  });
  const m = useMutation({
    mutationFn: async (v: boolean) => {
      const { error } = await db()
        .from("clarity_preferences")
        .upsert({ user_id: uid, product_question_invites: v });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  if (!uid) return null;
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 20,
        backgroundColor: "#EDF2EB",
        gap: 10,
      }}
    >
      <Label>Let your experience help someone</Label>
      <Note>
        Receive occasional questions about products you’ve used, including
        private timelines. Your product list and private updates are never shown
        to the person asking. Matching may use your saved skin type. You can
        turn this off anytime.
      </Note>
      {q.isLoading ? (
        <ContentSkeleton rows={1} />
      ) : q.isError ? (
        <StatusMessage kind="error" title="Invite preferences couldn’t load" />
      ) : (
        <Switch
          accessibilityLabel="Relevant product question invitations"
          disabled={m.isPending}
          value={q.data ?? true}
          onValueChange={(v) => m.mutate(v)}
        />
      )}{" "}
      {m.isError ? (
        <StatusMessage
          kind="error"
          title="Preference wasn’t saved. Try again."
        />
      ) : null}
    </View>
  );
}
