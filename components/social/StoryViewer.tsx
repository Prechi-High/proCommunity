import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { X } from "@/components/icons";
import { fonts } from "@/constants/theme";
import type { PulseMoment } from "@/lib/social/previewMoments";

import { LoopClip } from "./LoopClip";

const STORY_MS = 6000;

export function StoryViewer({
  queue,
  startIndex = 0,
  visible,
  onClose,
}: {
  queue: PulseMoment[];
  startIndex?: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setIndex(startIndex);
    setProgress(0);
    elapsed.current = 0;
  }, [visible, startIndex, queue]);

  const item = queue[index];

  useEffect(() => {
    if (!visible || !item) return;
    setProgress(0);
    elapsed.current = 0;
    const tick = setInterval(() => {
      elapsed.current += 80;
      const p = Math.min(1, elapsed.current / STORY_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        if (index < queue.length - 1) setIndex((i) => i + 1);
        else onClose();
      }
    }, 80);
    return () => clearInterval(tick);
  }, [visible, index, item?.id, queue.length]);

  if (!item) return null;

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
    else onClose();
  };

  const goNext = () => {
    if (index < queue.length - 1) setIndex((i) => i + 1);
    else onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {item.video ? (
          <LoopClip uri={item.video} poster={item.media || item.video} height={height} />
        ) : item.media ? (
          <Image
            source={{ uri: item.media }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#1A0A14" }} />
        )}
        <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]}>
          <View style={{ paddingHorizontal: 10, paddingTop: 6, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {queue.map((row, i) => (
                <View
                  key={row.id}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: "rgba(255,255,255,0.28)",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      backgroundColor: "#FFF8F4",
                      width:
                        i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                    }}
                  />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {item.face ? (
                <Image
                  source={{ uri: item.face }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#70323E",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#FFF8F4" }}>
                    {item.name.slice(0, 1)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF8F4" }}>{item.name}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: "rgba(255,248,244,0.72)" }}>Just now</Text>
              </View>
              <Pressable accessibilityLabel="Close stories" onPress={onClose} hitSlop={12}>
                <X size={22} color="#FFF8F4" />
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1, flexDirection: "row" }}>
            <Pressable style={{ flex: 1 }} onPress={goPrev} accessibilityLabel="Previous story" />
            <Pressable style={{ flex: 1 }} onPress={goNext} accessibilityLabel="Next story" />
          </View>
          <View style={{ paddingHorizontal: 18, paddingBottom: 16, gap: 8 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: "#FFF8F4" }}>{item.caption}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "#F0CF69" }}>
              {[item.skin ? `Skin · ${item.skin}` : "", item.product || "", item.timeline || ""]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
