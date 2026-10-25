import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import { Button, Busy, Card, Copy } from "@/components/unmask/reference/ui";
import { questions } from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";
export default function MyQuestions() {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const q = useQuery({
    queryKey: ["profile-questions", uid],
    queryFn: () => questions(uid!),
    enabled: !!uid,
  });
  return (
    <UtilityPage title="Your questions">
      {!uid ? (
        <SignInCard />
      ) : (
        <>
          <Busy
            loading={q.isLoading}
            error={q.error}
            retry={() => void q.refetch()}
          />
          {q.data?.map((i) => (
            <Card key={i.id}>
              <Copy>{i.body}</Copy>
              <Button
                quiet
                label="Open discussion"
                onPress={() => r.push(`/question/${i.id}` as Href)}
              />
            </Card>
          ))}
          {q.data?.length === 0 ? <Copy>No questions yet.</Copy> : null}
          <Button
            label="Ask the community"
            onPress={() => r.push("/ask-community")}
          />
        </>
      )}
    </UtilityPage>
  );
}
