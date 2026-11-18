import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Flask, ImageSquare, Sparkle, Sun, Waveform } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import { momentFlow } from "@/lib/moment/flowTheme";
import { playStudioSound, stopStudioSound } from "@/lib/moment/studioAudio";
import type { CreatorSettings } from "@/lib/moment/types";
import type { CreatorToolKind } from "@/components/moment/CreatorToolSheets";

const TOOLS: { key: Exclude<CreatorToolKind, null>; label: string; Icon: typeof Waveform }[] = [
  { key: "music", label: "Music", Icon: Waveform },
  { key: "background", label: "BG", Icon: ImageSquare },
  { key: "looks", label: "Looks", Icon: Sparkle },
  { key: "lighting", label: "Light", Icon: Sun },
  { key: "effects", label: "FX", Icon: Flask },
];

export function StudioDock({
  creator,
  open,
  onOpen,
  compact,
}: {
  creator: CreatorSettings;
  open: CreatorToolKind;
  onOpen: (k: CreatorToolKind) => void;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const sound = selectedSoundLabel(creator);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!sound) {
        await stopStudioSound();
        if (alive) setPlaying(false);
        return;
      }
      const ok = await playStudioSound(creator, { loop: true });
      if (alive) setPlaying(ok);
    })();
    return () => {
      alive = false;
    };
  }, [creator.soundId, creator.localSoundUri, sound]);

  return (
    <View style={{ gap: 10 }}>
      {sound ? (
        <View
          style={{
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.55)",
            borderWidth: 1,
            borderColor: "rgba(255,139,200,0.45)",
          }}
        >
          <Waveform size={14} color="#FF8BC8" weight="fill" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }} numberOfLines={1}>
            {playing ? "♪ " : ""}
            {sound}
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
        {TOOLS.map(({ key, label, Icon }) => {
          const active = open === key || toolHasValue(creator, key);
          return (
            <Pressable
              key={key}
              onPress={() => {
                hapticSelect();
                onOpen(open === key ? null : key);
              }}
              style={{
                minWidth: compact ? 64 : 72,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 18,
                alignItems: "center",
                gap: 4,
                backgroundColor: active ? "rgba(74,21,44,0.95)" : "rgba(0,0,0,0.42)",
                borderWidth: 1,
                borderColor: active ? "#FF8BC8" : "rgba(255,255,255,0.12)",
              }}
            >
              <Icon size={18} color="#FFF8F4" weight={active ? "fill" : "regular"} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF8F4" }}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function toolHasValue(creator: CreatorSettings, key: Exclude<CreatorToolKind, null>) {
  if (key === "music") return Boolean(creator.soundId || creator.localSoundUri);
  if (key === "background") return (creator.backgroundId && creator.backgroundId !== "original") || Boolean(creator.localBackgroundUri);
  if (key === "looks") return Boolean(creator.lookId && creator.lookId !== "none");
  if (key === "lighting") return Boolean(creator.lightingId && creator.lightingId !== "natural");
  if (key === "effects") return Boolean(creator.effectId && creator.effectId !== "none");
  return false;
}