import { useRouter, type Href } from "expo-router";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import {
  Page,
  Busy,
  Empty,
  Card,
  Body,
  Button,
  Tag,
  ActionStatus,
  useAction,
  useLivingQuery,
} from "@/components/living/ui";
export default function LivingNotifications() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const q = useLivingQuery(["activity"], api.activity, !!uid);
  const action = useAction();
  return (
    <Page
      back
      eyebrow="Meaningful updates"
      title="Worth returning for."
      sub="Followed-product updates and relevant questions. No reminders just to make you open the app."
    >
      <Busy loading={q.isLoading} error={q.error} />
      {q.data?.map((n) => (
        <Card key={n.id}>
          <Tag
            text={n.read_at ? "Read" : "New"}
            tone={n.read_at ? "neutral" : "gold"}
          />
          <Body>{n.title}</Body>
          {n.body ? <Body>{n.body}</Body> : null}
          <Button
            quiet
            label="Open update"
            onPress={() =>
              action.run(async () => {
                await api.readActivity(n.id);
                if (n.route) r.push(n.route as Href);
              })
            }
          />
        </Card>
      ))}
      {!uid || q.data?.length === 0 ? (
        <Empty
          title="You're up to date."
          body="Follow a product or share your experience to receive relevant updates."
        />
      ) : null}
      <ActionStatus action={action} />
    </Page>
  );
}
