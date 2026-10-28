import { FoundingLabel } from "./FoundingLabel";
import { SaveExperience } from "@/components/tracking/SaveExperience";
import { AttachedEvidence } from "@/components/tracking/AttachedEvidence";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  ArrowRight,
  ChatCircle,
  Lightning,
  Clock,
  Play,
} from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import type { FeedItem } from "@/lib/unmask/feed";
import { relativeTime } from "@/lib/unmask/time";
import { PersonAvatar } from "./PersonAvatar";
import { MediaFrame } from "./MediaFrame";
import { useAppStore } from "@/lib/store";
import { PostActions } from "./PostActions";
import { SparkMeter } from "./SparkMeter";
export function StoryCard({
  item,
  featured,
  flush,
}: {
  item: FeedItem;
  featured?: boolean;
  flush?: boolean;
}) {
  const r = useRouter();
  const added = useAppStore((s) =>
    item.sample
      ? (s.demoSparkAdds[item.sparkTargetId || item.href.split("/").pop()!] ??
        0)
      : 0,
  );
  const ultra = item.kind === "unmask";
  const question = item.kind === "question";
  const published = item.status === "Ultra Unmasked";
  const media = item.photo || item.productImage;
  const tone = ultra ? "#8C6319" : question ? "#386247" : colors.brand;
  const Icon = ultra ? Lightning : question ? ChatCircle : Clock;
  const kind = ultra
    ? "Ultra Unmask"
    : question
      ? "Community question"
      : "Product experience";
  const go = () => {
    hapticSelect();
    r.push(item.href as Href);
  };
  return (
    <View
      style={{
        marginHorizontal: flush ? 20 : 0,
        marginBottom: 18,
        borderRadius: 24,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: ultra ? "#D5B783" : "#EAE3DE",
        boxShadow: ultra ? "0 0 18px rgba(186, 139, 63, 0.13)" : undefined,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          padding: 16,
        }}
      >
        <PersonAvatar id={item.authorId} name={item.author} size={34} />
        <View style={{ flex: 1, gap: 2 }}>
          <Pressable
            disabled={!item.authorId}
            accessibilityRole="link"
            accessibilityLabel={`View ${item.author}'s profile`}
            onPress={() => r.push(`/member/${item.authorId}` as Href)}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 14,
                color: colors.ink,
              }}
            >
              {item.author}
            </Text>
          </Pressable>
          <FoundingLabel id={item.authorId}/>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 12,
              color: colors.inkSoft,
            }}
          >
            {relativeTime(item.createdAt)}
            {item.sample ? " · Design example" : ""}
          </Text>
        </View>
        {item.kind === "experience" ? (
          <SaveExperience
            id={item.href.split("/").pop()!}
            sample={item.sample}
          />
        ) : (
          <View
            style={{
              padding: 7,
              borderRadius: 12,
              backgroundColor: ultra
                ? "#F7EED8"
                : question
                  ? "#EDF2EC"
                  : "#F6ECEF",
            }}
          >
            <Icon size={18} color={tone} />
          </View>
        )}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${item.title}. ${published ? "Watch the Ultra Unmask" : question ? "Answer this question" : "Read the story"}`}
        onPress={go}
        style={({ pressed }) => ({ opacity: pressed ? 0.83 : 1 })}
      >
        {media && !question ? (
          <View style={{ paddingHorizontal: 12 }}>
            <MediaFrame
              uri={media}
              experiencePath={
                item.kind === "experience" ? item.photo : undefined
              }
              label={item.productName || item.title}
              ratio={ultra ? 16 / 9 : 4 / 3}
              play={published}
              corners={false}
            />
          </View>
        ) : null}
        <View style={{ padding: 18, gap: 11 }}>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 11,
              letterSpacing: 0.7,
              color: tone,
            }}
          >
            {kind.toUpperCase()}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Text
              style={{
                fontFamily: ultra ? fonts.serifBold : fonts.semibold,
                fontSize: featured ? 26 : 21,
                lineHeight: featured ? 31 : 27,
                color: colors.ink,
                flex: 1,
              }}
            >
              {item.title}
            </Text>
            {question && item.productImage ? (
              <View style={{ width: 64 }}>
                <MediaFrame
                  uri={item.productImage}
                  label={item.productName || "Product"}
                  ratio={1}
                  corners={false}
                />
              </View>
            ) : null}
          </View>
          {item.productName ? (
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: colors.inkSoft,
              }}
            >
              {item.productName}
            </Text>
          ) : null}
          {item.chips.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {item.chips.map((c, i) => (
                <View
                  key={i}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: "#F5F1EE",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 12,
                      color: colors.inkSoft,
                    }}
                  >
                    {c}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {ultra && typeof item.sparks === "number" && !published ? (
            <SparkMeter
              weight={item.sparks + added}
              goal={item.sparkGoal}
              compact
            />
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 3,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 14,
                color: colors.brandDeep,
              }}
            >
              {published
                ? "Watch the Ultra Unmask"
                : ultra
                  ? "See the story & add Sparks"
                  : question
                    ? "Share what you know"
                    : "Read the experience"}
            </Text>
            <ArrowRight size={19} color={colors.brand} />
          </View>
        </View>
      </Pressable>
      <AttachedEvidence
        attachedBy={item.author}
        journeyId={item.attachedJourneyId}
        experienceId={item.attachedExperienceId}
      />
      <PostActions item={item} />
    </View>
  );
}
