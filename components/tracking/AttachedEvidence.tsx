import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { db } from "@/lib/clarity/api";
import * as living from "@/lib/living/api";
import * as community from "@/lib/community-v2/api";
import * as tracking from "@/lib/tracking/api";
import { ActionButton } from "@/components/unmask-ui";
import { colors, fonts } from "@/constants/theme";
export function AttachedEvidence({
  journeyId,
  experienceId,
}: {
  journeyId?: string | null;
  experienceId?: string | null;
}) {
  const r = useRouter();
  const q = useQuery({
    queryKey: ["attached-evidence", journeyId, experienceId],
    enabled: !!journeyId || !!experienceId,
    queryFn: async () => {
      if (journeyId) {
        const [j, updates] = await Promise.all([
          living.journey(journeyId) as Promise<tracking.TrackedJourney>,
          tracking.updates(journeyId),
        ]);
        const publicUpdates = updates.filter((u) => u.visibility === "public");
        return {
          title: j.unmask_catalog?.name || "Product timeline",
          detail: [
            j.usage_duration,
            j.frequency,
            j.skin_type ? `${j.skin_type} skin` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          body:
            publicUpdates.at(-1)?.changed ||
            "Open the timeline to see the updates available to you.",
          label: `${publicUpdates.length} public update${publicUpdates.length === 1 ? "" : "s"} · Usage timeline`,
          verified: j.ownership_verified,
          href: `/journey/${j.id}`,
        };
      }
      const e = await community.experience(experienceId!);
      return {
        title: `${e.author_name}’s experience`,
        detail: e.duration || "Original experience",
        body: e.body,
        label: "Attached experience · credit stays with its author",
        verified: false,
        href: `/story/${e.id}`,
      };
    },
  });
  if (!journeyId && !experienceId) return null;
  return (
    <View
      style={{
        margin: 4,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#D9E1D6",
        backgroundColor: "#F2F5EE",
        gap: 8,
      }}
    >
      {q.isError ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            color: colors.inkSoft,
          }}
        >
          This attachment is private or no longer available.
        </Text>
      ) : q.data ? (
        <>
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 11,
              color: colors.sage,
            }}
          >
            {q.data.label}
          </Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 16,
              color: colors.ink,
            }}
          >
            {q.data.title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              lineHeight: 20,
              color: colors.inkSoft,
            }}
          >
            {q.data.detail}
          </Text>
          <Text
            numberOfLines={3}
            style={{
              fontFamily: fonts.regular,
              fontSize: 14,
              lineHeight: 22,
              color: colors.ink,
            }}
          >
            {q.data.body}
          </Text>
          {q.data.verified ? (
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 12,
                color: colors.sage,
              }}
            >
              Ownership verified · not a safety endorsement
            </Text>
          ) : null}
          <ActionButton
            tone="ghost"
            label="Open experience & updates"
            onPress={() => r.push(q.data!.href as Href)}
          />
        </>
      ) : (
        <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft }}>
          Opening attached experience…
        </Text>
      )}
    </View>
  );
}
