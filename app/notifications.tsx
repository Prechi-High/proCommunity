import { readAllActivity } from "@/lib/utilities/api";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { UtilityPage, SignInCard } from "@/components/utilities/Page";
import {
  Busy,
  Button,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Pill,
} from "@/components/unmask/reference/ui";
import { useNotifications } from "@/components/social";
import { markNotificationsRead } from "@/lib/community";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
export default function Notifications() {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const old = useNotifications();
  const q = useQuery({
    queryKey: ["living", "activity", uid],
    queryFn: api.activity,
    enabled: !!uid,
  });
  const items = [
    ...(q.data ?? []).map((n) => ({
      id: `activity-${n.id}`,
      title: n.title,
      body: n.body,
      date: n.created_at,
      read: !!n.read_at,
      route: n.route,
      activityId: n.id,
      category:
        n.kind === "investigation"
          ? "Investigations"
          : n.kind === "person"
            ? "People"
            : ["answer", "reply"].includes(n.kind)
              ? "Replies"
              : "Other",
    })),
    ...(old.data?.notifications ?? []).map((n) => ({
      id: `thread-${n.id}`,
      title: `${n.actor_name} replied to ${n.thread_title}`,
      body: n.snippet,
      date: n.created_at,
      read: n.read,
      route: `/thread/${n.thread_id}`,
      activityId: null,
      category: "Replies",
    })),
  ]
    .filter(
      (n) =>
        filter === "All" ||
        (filter === "Unread" ? !n.read : n.category === filter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const open = async (n: (typeof items)[number]) => {
    setBusy(true);
    setError("");
    try {
      if (n.activityId) await api.readActivity(n.activityId);
      else await markNotificationsRead();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["living", "activity"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      if (n.route?.startsWith("/") && !n.route.startsWith("//"))
        r.push(n.route as Href);
    } catch {
      setError("Could not open this update. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <UtilityPage
      title="Your updates"
      sub="Activity from people, investigations and conversations you care about."
    >
      {!uid ? (
        <SignInCard />
      ) : (
        <>
          <Button
            quiet
            label="Notification settings"
            onPress={() => r.push("/settings/details?section=notifications")}
          />
          <Button
            quiet
            disabled={busy}
            label="Mark all read"
            onPress={() => {
              setBusy(true);
              setError("");
              void Promise.all([readAllActivity(), markNotificationsRead()])
                .then(() =>
                  Promise.all([
                    qc.invalidateQueries({ queryKey: ["living", "activity"] }),
                    qc.invalidateQueries({ queryKey: ["notifications"] }),
                  ]),
                )
                .catch(() =>
                  setError("Some updates could not be marked read. Retry."),
                )
                .finally(() => setBusy(false));
            }}
          />
          <Chips
            options={["All", "Investigations", "Replies", "People", "Unread"]}
            value={filter}
            onChange={setFilter}
          />
          <Busy
            loading={q.isLoading || old.isLoading}
            error={q.error || old.error}
            retry={() => {
              void q.refetch();
              void old.refetch();
            }}
          />
          {error ? <Notice>{error}</Notice> : null}
          {items.map((n) => (
            <Card key={n.id}>
              <Pill>{n.read ? "Read" : "New"}</Pill>
              <Heading>{n.title}</Heading>
              {n.body ? <Copy>{n.body}</Copy> : null}
              <Copy small>{new Date(n.date).toLocaleString()}</Copy>
              <Button
                quiet
                disabled={busy}
                label="Open update"
                onPress={() => void open(n)}
              />
            </Card>
          ))}
          {!q.isLoading &&
          !old.isLoading &&
          !q.isError &&
          !old.isError &&
          items.length === 0 ? (
            <Card>
              <Heading>You're all caught up.</Heading>
              <Copy>
                Follow a product or join a conversation to see relevant updates
                here.
              </Copy>
              <Button
                label="Explore community"
                onPress={() => r.push("/pulse")}
              />
            </Card>
          ) : null}
        </>
      )}
    </UtilityPage>
  );
}
