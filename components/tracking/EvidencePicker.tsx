import { ContentSkeleton } from "@/components/unmask-ui/Skeleton";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useAppStore } from "@/lib/store";
import * as tracking from "@/lib/tracking/api";
import {
  ActionSheet,
  ActionButton,
  StatusMessage,
} from "@/components/unmask-ui";
import { colors, fonts } from "@/constants/theme";
export function EvidencePicker({
  value,
  onChange,
  publicPost = true,
}: {
  value: tracking.EvidenceSelection | null;
  onChange: (v: tracking.EvidenceSelection | null) => void;
  publicPost?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const uid = useAppStore((s) => s.profile?.id);
  const r = useRouter();
  const q = useQuery({
    queryKey: ["evidence-options", uid],
    queryFn: tracking.attachmentOptions,
    enabled: open && !!uid,
  });
  return (
    <View style={{ gap: 10 }}>
      <ActionButton
        tone="secondary"
        label={
          value
            ? "Change attached experience"
            : "Attach an experience or usage timeline"
        }
        onPress={() => setOpen(true)}
      />
      {value ? (
        <View
          style={{
            padding: 14,
            borderRadius: 16,
            backgroundColor: "#EEF2EC",
            gap: 6,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 14,
              color: colors.ink,
            }}
          >
            {value.title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12,
              lineHeight: 18,
              color: colors.inkSoft,
            }}
          >
            {value.detail}
            {value.author ? ` · Shared by ${value.author}` : ""}
          </Text>
          <ActionButton
            tone="ghost"
            label="Remove attachment"
            onPress={() => onChange(null)}
          />
        </View>
      ) : null}
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Bring the experience with you"
      >
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 14,
            lineHeight: 22,
            color: colors.inkSoft,
          }}
        >
          Choose a product timeline, your own experience, or a saved experience.
          The original author keeps the credit.
        </Text>
        {!uid ? (
          <ActionButton
            label="Sign in to see your experiences"
            onPress={() => {
              setOpen(false);
              r.push("/(auth)/sign-in");
            }}
          />
        ) : null}
        {q.isLoading ? <ContentSkeleton /> : null}
        {q.isError ? (
          <ActionButton
            label="Retry experiences"
            onPress={() => void q.refetch()}
          />
        ) : null}
        {(q.data ?? []).map((x) => {
          const privateSource = publicPost && x.visibility !== "public";
          return (
            <View key={`${x.kind}-${x.id}`} style={{ gap: 4 }}>
              <Pressable
                accessibilityRole="button"
                disabled={privateSource}
                accessibilityLabel={`${x.title}${privateSource ? ", private source cannot be shared publicly" : ""}`}
                onPress={() => {
                  onChange(x);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: pressed ? "#EDE1DC" : "#F5F0EB",
                  opacity: privateSource ? 0.6 : 1,
                  gap: 6,
                })}
              >
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 11,
                    color: colors.brand,
                  }}
                >
                  {x.kind === "journey"
                    ? "TRACKED PRODUCT TIMELINE"
                    : x.author
                      ? `EXPERIENCE · ${x.author}`
                      : "MY EXPERIENCE"}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 15,
                    lineHeight: 22,
                    color: colors.ink,
                  }}
                >
                  {x.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 13,
                    color: colors.inkSoft,
                  }}
                >
                  {x.detail}
                </Text>
                {privateSource ? (
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 12,
                      color: colors.inkSoft,
                    }}
                  >
                    Private. Make the source public before attaching to this
                    conversation.
                  </Text>
                ) : null}
              </Pressable>
              {privateSource && x.kind === "journey" ? (
                <ActionButton
                  tone="ghost"
                  label="Open privacy settings"
                  onPress={() => {
                    setOpen(false);
                    r.push(`/journey/${x.id}` as Href);
                  }}
                />
              ) : null}
            </View>
          );
        })}
        {uid && q.isSuccess && !q.data.length ? (
          <StatusMessage
            title="No experiences to attach yet."
            detail="Track a product, publish your experience, or save someone’s public experience first."
          />
        ) : null}
        <ActionButton
          tone="ghost"
          label="Start a product timeline"
          onPress={() => {
            setOpen(false);
            r.push("/products/add");
          }}
        />
      </ActionSheet>
    </View>
  );
}
