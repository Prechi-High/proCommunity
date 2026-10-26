import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BookmarkSimple } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import { bookmarks, toggleBookmark } from "@/lib/utilities/api";
export function SaveExperience({
  id,
  sample,
}: {
  id: string;
  sample?: boolean;
}) {
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter(),
    qc = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["bookmarks", uid],
    queryFn: bookmarks,
    enabled: !!uid && !sample,
  });
  const saved = q.data?.find((x) => x.experience_id === id);
  async function toggle() {
    if (sample) {
      setError("Saving is available on real experiences.");
      return;
    }
    if (!uid) {
      r.push("/(auth)/sign-in");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await toggleBookmark("experience", id, saved?.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["bookmarks", uid] }),
        qc.invalidateQueries({ queryKey: ["evidence-options", uid] }),
      ]);
    } catch {
      setError("Couldn’t save this experience. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ alignItems: "flex-end", maxWidth: 140 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          saved ? "Remove saved experience" : "Save experience to attach later"
        }
        disabled={busy}
        onPress={() => void toggle()}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BookmarkSimple
          size={22}
          color={colors.brand}
          weight={saved ? "fill" : "regular"}
        />
      </Pressable>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontFamily: fonts.regular,
            fontSize: 10,
            lineHeight: 14,
            color: colors.inkSoft,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
