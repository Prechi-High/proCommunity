import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import {
  MOMENT_BACKGROUNDS,
  MOMENT_EFFECTS,
  MOMENT_LIGHTING,
  MOMENT_LOOKS,
  MOMENT_SOUNDS,
} from "@/lib/moment/creatorCatalog";
import { momentFlow } from "@/lib/moment/flowTheme";
import type { CreatorSettings } from "@/lib/moment/types";

export type CreatorToolKind = "music" | "looks" | "background" | "lighting" | "beauty" | "effects" | "timer" | null;

export function CreatorToolSheets({
  open,
  creator,
  onClose,
  onChange,
}: {
  open: CreatorToolKind;
  creator: CreatorSettings;
  onClose: () => void;
  onChange: (next: CreatorSettings) => void;
}) {
  const titles: Record<Exclude<CreatorToolKind, null>, string> = {
    music: "Music",
    looks: "Looks",
    background: "Background",
    lighting: "Lighting",
    beauty: "Beauty",
    effects: "Effects",
    timer: "Timer & speed",
  };

  if (!open) return null;

  return (
    <ActionSheet open title={titles[open]} onClose={onClose}>
      {open === "music" ? (
        <ScrollView style={{ maxHeight: 360 }}>
          {MOMENT_SOUNDS.map((s) => {
            const on = creator.soundId === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  hapticSelect();
                  onChange({ ...creator, soundId: on ? undefined : s.id });
                }}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: on ? momentFlow.accent : momentFlow.ink }}>{s.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>
                  {s.artist}
                  {s.trending ? " · Trending" : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {open === "looks" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {MOMENT_LOOKS.map((l) => {
            const on = creator.lookId === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => {
                  hapticSelect();
                  onChange({ ...creator, lookId: on ? undefined : l.id });
                }}
                style={{
                  width: "47%",
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: l.preview,
                  borderWidth: on ? 2 : 0,
                  borderColor: momentFlow.accent,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.ink }}>{l.title}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {open === "background" ? (
        <View style={{ gap: 8 }}>
          {MOMENT_BACKGROUNDS.map((b) => {
            const on = (creator.backgroundId ?? "original") === b.id;
            return (
              <Pressable
                key={b.id}
                onPress={() => {
                  hapticSelect();
                  onChange({ ...creator, backgroundId: b.id });
                }}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: on ? momentFlow.accent : momentFlow.card,
                  borderWidth: 1,
                  borderColor: momentFlow.accentSoft,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: on ? "#FFF8F4" : momentFlow.ink }}>{b.title}</Text>
                {b.mode === "blur" ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: on ? "rgba(255,248,244,0.85)" : momentFlow.muted }}>Portrait blur (fallback: original on web)</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {open === "lighting" ? (
        <View style={{ gap: 8 }}>
          {MOMENT_LIGHTING.map((l) => {
            const on = creator.lightingId === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => {
                  hapticSelect();
                  onChange({ ...creator, lightingId: on ? undefined : l.id });
                }}
                style={{ padding: 14, borderRadius: 14, backgroundColor: on ? momentFlow.pillPink : momentFlow.card }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>{l.title}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {open === "beauty" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Subtle beauty</Text>
          <Switch
            value={!!creator.beautyEnabled}
            onValueChange={(beautyEnabled) => onChange({ ...creator, beautyEnabled })}
            trackColor={{ true: momentFlow.accent, false: momentFlow.accentSoft }}
          />
        </View>
      ) : null}

      {open === "effects" ? (
        <View style={{ gap: 8 }}>
          {MOMENT_EFFECTS.map((e) => {
            const on = (creator.effectId ?? "none") === e.id;
            return (
              <Pressable
                key={e.id}
                onPress={() => {
                  hapticSelect();
                  onChange({ ...creator, effectId: e.id === "none" ? undefined : e.id });
                }}
                style={{ padding: 14, borderRadius: 14, backgroundColor: on ? momentFlow.accent : momentFlow.card }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: on ? "#FFF8F4" : momentFlow.ink }}>{e.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: on ? "rgba(255,248,244,0.85)" : momentFlow.muted }}>
                  {e.provider === "snap" ? "Snap Lens preview (flagged)" : "Unmask effect"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {open === "timer" ? (
        <View style={{ gap: 14 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted }}>Timer</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[0, 3, 5, 10].map((sec) => {
              const on = (creator.timerSec ?? 0) === sec;
              return (
                <Pressable
                  key={sec}
                  onPress={() => {
                    hapticSelect();
                    onChange({ ...creator, timerSec: sec || undefined });
                  }}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: on ? momentFlow.accent : momentFlow.pillPink, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? "#FFF8F4" : momentFlow.ink }}>{sec ? `${sec}s` : "Off"}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted }}>Speed</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {([0.5, 1, 2] as const).map((speed) => {
              const on = (creator.captureSpeed ?? 1) === speed;
              return (
                <Pressable
                  key={speed}
                  onPress={() => {
                    hapticSelect();
                    onChange({ ...creator, captureSpeed: speed });
                  }}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: on ? momentFlow.accent : momentFlow.pillPink, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? "#FFF8F4" : momentFlow.ink }}>{speed}x</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </ActionSheet>
  );
}