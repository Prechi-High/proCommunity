import { useState } from "react";
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
  const uid = useAppStore((s) => s.profile?.id);
  const q = useLivingQuery(["subscriptions"], api.subscriptions, !!uid);
  const action = useAction();
  const sub = q.data?.find((s) => s.target_type === type && s.target_id === id);
  const [editing, setEditing] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Button
        quiet={!!sub}
        label={sub ? "Following · manage" : `Follow ${type}`}
        disabled={action.isPending}
        onPress={() =>
          sub ? setEditing(!editing) : action.run(() => api.follow(type, id))
        }
      />
      {editing && sub ? (
        <>
          <Button
            quiet
            label="Unfollow"
            onPress={() => action.run(() => api.unfollow(type, id))}
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
