import { Pressable, Text, View } from "react-native";

import { Waveform } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import type { CreatorSettings } from "@/lib/moment/types";
import type { CreatorToolKind } from "@/components/moment/CreatorToolSheets";

/** Music-only dock — BG/looks/FX removed from create. */
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
  hideTools?: Array<"music">;
}) {
  const sound = selectedSoundLabel(creator);
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
            {sound}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => {
          hapticSelect();
          onOpen(open === "music" ? null : "music");
        }}
        style={{
          alignSelf: "center",
          minWidth: compact ? 64 : 72,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 18,
          alignItems: "center",
          gap: 4,
          backgroundColor: open === "music" || sound ? "rgba(74,21,44,0.95)" : "rgba(0,0,0,0.42)",
          borderWidth: 1,
          borderColor: open === "music" || sound ? "#FF8BC8" : "rgba(255,255,255,0.12)",
        }}
      >
        <Waveform size={18} color="#FFF8F4" weight={sound ? "fill" : "regular"} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF8F4" }}>Music</Text>
      </Pressable>
    </View>
  );
}
