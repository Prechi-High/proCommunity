import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Plus, Trash } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";
import type { MomentMediaAsset } from "@/lib/moment/types";

export function SlideStrip({
  slides,
  activeId,
  onSelect,
  onCaption,
  onRemove,
  onAdd,
}: {
  slides: MomentMediaAsset[];
  activeId?: string;
  onSelect: (id: string) => void;
  onCaption: (id: string, caption: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  const active = slides.find((s) => s.id === activeId) ?? slides[0];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>Slides ({slides.length})</Text>
        <Pressable
          onPress={() => {
            hapticSelect();
            onAdd();
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: momentFlow.pillPink }}
        >
          <Plus size={14} color={momentFlow.accent} weight="bold" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.accent }}>Add slide</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {slides.map((slide, index) => {
          const on = slide.id === active?.id;
          return (
            <Pressable
              key={slide.id}
              onPress={() => onSelect(slide.id)}
              style={{
                width: 88,
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: on ? 2 : 1,
                borderColor: on ? momentFlow.accent : momentFlow.accentSoft,
                backgroundColor: momentFlow.card,
              }}
            >
              <Image source={{ uri: slide.uri }} style={{ width: "100%", height: 110 }} resizeMode="cover" accessibilityIgnoresInvertColors />
              <View style={{ padding: 6, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: momentFlow.ink }}>{index + 1}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 10, color: momentFlow.muted }}>
                  {slide.caption || "No caption"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {active ? (
        <View style={{ gap: 8, padding: 14, borderRadius: 16, backgroundColor: momentFlow.card, borderWidth: 1, borderColor: momentFlow.accentSoft }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.ink }}>Caption for this slide</Text>
          <TextInput
            value={active.caption ?? ""}
            onChangeText={(t) => onCaption(active.id, t)}
            placeholder="Say what this moment is…"
            placeholderTextColor={momentFlow.muted}
            multiline
            style={{
              minHeight: 64,
              fontFamily: fonts.regular,
              fontSize: 15,
              color: momentFlow.ink,
              textAlignVertical: "top",
            }}
          />
          {slides.length > 1 ? (
            <Pressable
              onPress={() => {
                hapticSelect();
                onRemove(active.id);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
            >
              <Trash size={14} color={momentFlow.warnInk} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.warnInk }}>Remove slide</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}