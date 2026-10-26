import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  AppShell,
  ActionButton,
  EmptyState,
  FilterChips,
  StatusMessage,
} from "@/components/unmask-ui";
import {
  Bell,
  ChatCircle,
  Sparkle,
  UsersThree,
  Checks,
  Gear,
  CaretRight,
} from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { useNotifications } from "@/components/social";
import { markNotificationsRead } from "@/lib/community";
import { readAllActivity } from "@/lib/utilities/api";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import { relativeTime } from "@/lib/unmask/time";
type Update = {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
  route: string | null;
  activityId: string | null;
  category: string;
};
export default function Notifications() {
  const uid = useAppStore((s) => s.profile?.id);
  const demo = useAppStore((s) => s.demoCommunity);
  const acknowledged = useAppStore((s) => s.notificationAckIds);
  const acknowledge = useAppStore((s) => s.ackNotifications);
  const r = useRouter(),
    qc = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const old = useNotifications();
  const q = useQuery({
    queryKey: ["living", "activity", uid],
    queryFn: api.activity,
    enabled: !!uid,
  });
  const samples: Update[] = [
    {
      id: "demo-n1",
      title: "Chioma has a new update",
      body: "A closer look at sunscreen layering.",
      date: new Date(Date.now() - 3600000).toISOString(),
      read: false,
      route: "/member/sample-c-chioma",
      activityId: null,
      category: "Creators",
    },
    {
      id: "demo-n2",
      title: "Your story is getting support",
      body: "See the demo Ultra Unmask taking shape.",
      date: new Date(Date.now() - 7200000).toISOString(),
      read: false,
      route: "/investigation/sample-unmask-1",
      activityId: null,
      category: "Ultra Unmasks",
    },
    {
      id: "demo-n3",
      title: "The conversation continues",
      body: "Bukky added context to Amaka’s week-six update.",
      date: new Date(Date.now() - 86400000).toISOString(),
      read: true,
      route: "/story/sample-exp-1",
      activityId: null,
      category: "Replies",
    },
  ];
  const rows: Update[] = demo
    ? samples
    : [
        ...(q.data ?? []).map((n) => ({
          id: `activity-${n.id}`,
          title: n.title,
          body: n.body || "",
          date: n.created_at,
          read: !!n.read_at,
          route: n.route,
          activityId: n.id,
          category:
            n.kind === "investigation"
              ? "Ultra Unmasks"
              : n.kind === "person"
                ? "Creators"
                : ["answer", "reply"].includes(n.kind)
                  ? "Replies"
                  : "Other",
        })),
        ...(old.data?.notifications ?? []).map((n) => ({
          id: `thread-${n.id}`,
          title: `${n.actor_name} replied`,
          body: n.snippet || n.thread_title || "",
          date: n.created_at,
          read: n.read,
          route: `/thread/${n.thread_id}`,
          activityId: null,
          category: "Replies",
        })),
      ];
  const items = rows
    .map((n) => ({
      ...n,
      read: n.read || acknowledged.includes(`${uid || "guest"}:${n.id}`),
    }))
    .filter(
      (n) =>
        filter === "All" ||
        (filter === "Unread" ? !n.read : n.category === filter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  async function open(n: Update) {
    setError("");
    acknowledge([`${uid || "guest"}:${n.id}`]);
    if (!demo && n.activityId) {
      try {
        await api.readActivity(n.activityId);
        void qc.invalidateQueries({ queryKey: ["living", "activity"] });
      } catch {
        setError("This update opened, but its read status could not sync.");
      }
    }
    if (n.route?.startsWith("/") && !n.route.startsWith("//"))
      r.push(n.route as Href);
  }
  async function readAll() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!demo)
        await Promise.all([readAllActivity(), markNotificationsRead()]);
      acknowledge(rows.map((n) => `${uid || "guest"}:${n.id}`));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["living", "activity"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    } catch {
      setError("Some updates could not be marked read. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const failed = !demo && (q.isError || old.isError);
  const loading = !demo && !!uid && (q.isLoading || old.isLoading);
  return (
    <AppShell
      back
      navigation
      title="Notifications"
      subtitle="Your people. Your products. What’s new."
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.medium,
            color: colors.inkSoft,
            fontSize: 13,
          }}
        >
          {demo
            ? "Demo updates"
            : `${items.filter((n) => !n.read).length} unread`}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications read"
            disabled={busy || (!uid && !demo)}
            onPress={() => void readAll()}
            style={{ padding: 12, opacity: busy ? 0.4 : 1 }}
          >
            <Checks size={24} color={colors.brand} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notification settings"
            onPress={() => r.push("/settings/details?section=notifications")}
            style={{ padding: 12 }}
          >
            <Gear size={23} color={colors.inkSoft} />
          </Pressable>
        </View>
      </View>
      <FilterChips
        options={["All", "Unread", "Replies", "Creators"]}
        value={filter}
        onChange={setFilter}
      />
      {error ? <StatusMessage kind="error" title={error} /> : null}
      {!uid && !demo ? (
        <EmptyState
          title="Keep up with your community."
          detail="Sign in to see replies, creator updates and product news."
          action="Sign in"
          onAction={() => r.push("/(auth)/sign-in")}
        />
      ) : null}
      {loading ? (
        <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
          Loading your updates…
        </Text>
      ) : null}
      {failed ? (
        <ActionButton
          label="Retry notifications"
          tone="secondary"
          onPress={() => {
            void q.refetch();
            void old.refetch();
          }}
        />
      ) : null}
      <View>
        {items.map((n, i) => {
          const Icon =
            n.category === "Replies"
              ? ChatCircle
              : n.category === "Creators"
                ? UsersThree
                : Sparkle;
          const day =
            new Date(n.date).toDateString() === new Date().toDateString()
              ? "Today"
              : "Earlier";
          const prev = i
            ? new Date(items[i - 1].date).toDateString() ===
              new Date().toDateString()
              ? "Today"
              : "Earlier"
            : null;
          return (
            <View key={n.id}>
              {day !== prev ? (
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 14,
                    color: colors.ink,
                    paddingVertical: 12,
                  }}
                >
                  {day}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${n.read ? "" : "Unread. "}${n.title}. ${n.body}`}
                onPress={() => void open(n)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  paddingVertical: 18,
                  borderRadius: 18,
                  marginBottom: 4,
                  backgroundColor: pressed
                    ? "#EFE3E6"
                    : n.read
                      ? "#fff"
                      : "#F8F1F3",
                })}
              >
                <View
                  style={{
                    height: 42,
                    width: 42,
                    borderRadius: 15,
                    backgroundColor:
                      n.category === "Ultra Unmasks" ? "#FAEBC7" : "#EDE6E4",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={21} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: n.read ? fonts.medium : fonts.semibold,
                      fontSize: 14,
                      lineHeight: 20,
                      color: colors.ink,
                    }}
                  >
                    {n.title}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 13,
                      lineHeight: 19,
                      color: colors.inkSoft,
                    }}
                  >
                    {n.body}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 11,
                      color: colors.inkSoft,
                    }}
                  >
                    {relativeTime(n.date)}
                  </Text>
                </View>
                {!n.read ? (
                  <View
                    style={{
                      height: 7,
                      width: 7,
                      borderRadius: 4,
                      backgroundColor: colors.brand,
                    }}
                  />
                ) : (
                  <CaretRight size={15} color={colors.inkSoft} />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
      {!loading && !failed && !items.length && (uid || demo) ? (
        <EmptyState
          title="You’re all caught up."
          detail="Replies and creator updates will appear here."
        />
      ) : null}
    </AppShell>
  );
}
