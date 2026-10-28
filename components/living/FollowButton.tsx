import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import * as api from "@/lib/living/api";
import { useAppStore } from "@/lib/store";
import { ActionStatus, Button, Choices, useAction, useLivingQuery } from "./ui";
export function FollowButton({
  type,
  id,
  preferences = false,
}: {
  type: string;
  id: string;
  preferences?: boolean;
}) {
  const router=useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const q = useLivingQuery(["subscriptions", uid], api.subscriptions, !!uid);
  const action = useAction();
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["profile-people"] }),
      qc.invalidateQueries({ queryKey: ["profile-counts"] }),
      qc.invalidateQueries({ queryKey: ["subscriptions"] }),
      qc.invalidateQueries({ queryKey: ["investigation-browse"] }),
    ]);
  };
  const sub = q.data?.find((s) => s.target_type === type && s.target_id === id);
  const [editing, setEditing] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Button
        quiet={!!sub}
        label={sub ? "Following · manage" : "Follow"}
        disabled={action.isPending}
        onPress={() =>
          !uid ? router.push({pathname:"/(auth)/sign-in",params:{returnTo:`/member/${id}`}} as Href) : sub
            ? setEditing(!editing)
            : action.run(async () => {
                await api.follow(type, id);
                await refresh();
              })
        }
      />
      {editing && sub ? (
        <>
          <Button
            quiet
            label="Unfollow"
            onPress={() =>
              action.run(async () => {
                await api.unfollow(type, id);
                await refresh();
              })
            }
          />
          {preferences ? (
            <Choices
              label="Notify me about"
              value={
                sub.preferences.includes("all")
                  ? "all"
                  : sub.preferences.includes("experiences")
                    ? "experiences"
                    : "long_term"
              }
              options={[
                { id: "all", label: "All updates" },
                { id: "experiences", label: "New experiences" },
                { id: "long_term", label: "Long-term only" },
              ]}
              onChange={(p) =>
                action.run(() => api.follow(type, id, [p, "questions"]))
              }
            />
          ) : null}
        </>
      ) : null}
      <ActionStatus action={action} />
    </View>
  );
}
