import { Platform, Pressable, Text, View } from "react-native";

import { Package, UsersThree } from "@/components/icons";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { colors, fonts } from "@/constants/theme";
import { peopleLabel, recordingCopy } from "@/lib/room/context";
import type { RoomProductChip } from "@/lib/room/types";

import { AudioBars, HostFace } from "./SpeakingAvatar";

export function RoomCard({
  title,
  description,
  status,
  hostName,
  hostHandle,
  hostAvatar,
  hostMark,
  count,
  talking,
  speakerName,
  products,
  topic,
  when,
  recordingStatus,
  isHost,
  onPress,
}: {
  title: string;
  description?: string;
  status: "live" | "scheduled";
  hostName: string;
  hostHandle?: string | null;
  hostAvatar?: string | null;
  hostMark?: string | null;
  count: number;
  talking?: boolean;
  speakerName?: string;
  products: RoomProductChip[];
  topic?: string;
  when?: string;
  recordingStatus?: string | null;
  isHost?: boolean;
  onPress: () => void;
}) {
  const live = status === "live";
  const recording = recordingCopy(recordingStatus);
  const product = products[0];
  const label = isHost ? "You're hosting" : live ? "Live" : "Scheduled";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${title}. Hosted by ${hostName}. ${peopleLabel(count)} here.`}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 16,
        borderRadius: 24,
        backgroundColor: colors.lac,
        borderWidth: 1,
        borderColor: colors.line,
        gap: 12,
        opacity: pressed ? 0.88 : 1,
        ...(Platform.OS === "web" ? { cursor: "pointer" as const } : null),
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? colors.coral : colors.honey }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.4, color: live ? colors.coral : colors.honeyInk }}>
          {label.toUpperCase()}
        </Text>
        <View style={{ flex: 1 }} />
        {live && recording.active ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.coral }}>{recording.label}</Text>
        ) : null}
        {live ? <AudioBars active={!!talking} height={16} /> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <HostFace name={hostName} uri={hostAvatar} size={44} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{hostName}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft }}>
            {hostHandle ? `@${hostHandle} · ` : ""}Creator
          </Text>
        </View>
        <CreatorMark mark={hostMark || hostName} size={28} />
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.ink }}>{title}</Text>
      {description ? (
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft }}>{description}</Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {topic ? <Chip label={topic} /> : null}
        {product ? <Chip label={product.brand ? `${product.brand} ${product.name}` : product.name} icon /> : <Chip label="No product pinned" muted />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <UsersThree size={16} color={colors.inkSoft} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft }}>
          {live
            ? `${peopleLabel(count)} here${talking ? ` · ${speakerName || "Someone"} speaking` : " · Waiting"}`
            : when || "Scheduled"}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.brand }}>{isHost ? "Resume" : live ? "Join" : "View"}</Text>
      </View>
    </Pressable>
  );
}

function Chip({ label, icon, muted }: { label: string; icon?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, minHeight: 30, borderRadius: 999, backgroundColor: muted ? colors.mist : colors.hiSoft }}>
      {icon ? <Package size={13} color={colors.hiInk} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12, color: muted ? colors.inkSoft : colors.hiInk, maxWidth: 220 }}>{label}</Text>
    </View>
  );
}
