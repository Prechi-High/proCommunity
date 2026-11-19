import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, Share, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";

import { ArrowClockwise, CalendarBlank, Heart, ShareNetwork, Sun, UserCircle, X } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { resolvePlayableUri } from "@/lib/moment/mediaBlobStore";
import { useLocalMoments } from "@/lib/moment/localPosts";
import { stopStudioSound, UNMASK_IMAGE_BGM_MAX_SEC } from "@/lib/moment/studioAudio";
import { useAppStore } from "@/lib/store";
import type { PulseMoment } from "@/lib/social/previewMoments";
import { usePageActive } from "@/lib/usePageActive";

import { LoopClip } from "./LoopClip";

const STORY_MS = 6000;

export function StoryViewer({
  queue,
  startIndex = 0,
  visible,
  onClose,
  onFinishedPerson,
  interactive,
}: {
  queue: PulseMoment[];
  startIndex?: number;
  visible: boolean;
  onClose: () => void;
  onFinishedPerson?: () => void;
  interactive?: boolean;
}) {
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [videoUri, setVideoUri] = useState<string>("");
  const elapsed = useRef(0);
  const paused = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pageActive = usePageActive();
  const toggleLike = useLocalMoments((s) => s.toggleStoryLike);
  const reshareStory = useLocalMoments((s) => s.reshareStory);
  const storyLikes = useLocalMoments((s) => s.storyLikes);
  const display = useAppStore((s) => s.profile?.displayName) || "You";

  const live = visible && pageActive;

  useEffect(() => {
    if (!visible) return;
    setIndex(startIndex);
    setProgress(0);
    elapsed.current = 0;
    paused.current = false;
  }, [visible, startIndex, queue, queue.length]);

  // Leaving the tab / backgrounding must stop status + BGM — do not keep running off-screen.
  const hadFocus = useRef(false);
  useEffect(() => {
    if (visible && pageActive) hadFocus.current = true;
    if (!visible) {
      hadFocus.current = false;
      return;
    }
    if (!hadFocus.current || pageActive) return;
    paused.current = true;
    void (async () => {
      try {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
      } catch {
        /* ignore */
      }
      soundRef.current = null;
      await stopStudioSound();
    })();
    onClose();
  }, [pageActive, visible, onClose]);

  const item = queue[index];
  const durationMs = item?.video
    ? STORY_MS
    : Math.min((item?.soundMaxMs || UNMASK_IMAGE_BGM_MAX_SEC * 1000), UNMASK_IMAGE_BGM_MAX_SEC * 1000) || STORY_MS;

  useEffect(() => {
    if (!live || !item) return;
    setProgress(0);
    elapsed.current = 0;
    paused.current = false;
    const tick = setInterval(() => {
      if (paused.current) return;
      elapsed.current += 80;
      const p = Math.min(1, elapsed.current / durationMs);
      setProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        if (index < queue.length - 1) setIndex((i) => i + 1);
        else if (onFinishedPerson) onFinishedPerson();
        else onClose();
      }
    }, 80);
    return () => clearInterval(tick);
  }, [live, index, item?.id, queue.length, onClose, onFinishedPerson, durationMs]);

  // Resolve durable video URIs (IndexedDB) before LoopClip plays
  useEffect(() => {
    let cancelled = false;
    if (!item?.video) {
      setVideoUri("");
      return;
    }
    void (async () => {
      try {
        const next = await resolvePlayableUri(item.video!);
        if (!cancelled) setVideoUri(next || item.video!);
      } catch {
        if (!cancelled) setVideoUri(item.video!);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.video, item?.id]);

  // Photo / slide BGM — only while status is visible AND tab is foreground
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await soundRef.current?.unloadAsync();
      } catch {
        /* ignore */
      }
      soundRef.current = null;
      if (!live || !item?.soundUri || item.video) return;
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
        const playUri = await resolvePlayableUri(item.soundUri);
        const { sound } = await Audio.Sound.createAsync(
          { uri: playUri },
          { shouldPlay: true, isLooping: false, volume: 1 },
        );
        if (!alive) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          const maxMs = Math.min(item.soundMaxMs || UNMASK_IMAGE_BGM_MAX_SEC * 1000, UNMASK_IMAGE_BGM_MAX_SEC * 1000);
          if (status.positionMillis >= maxMs) {
            void sound.stopAsync();
          }
        });
      } catch {
        /* preview optional */
      }
    })();
    return () => {
      alive = false;
      void (async () => {
        try {
          await soundRef.current?.stopAsync();
          await soundRef.current?.unloadAsync();
        } catch {
          /* ignore */
        }
        soundRef.current = null;
      })();
    };
  }, [live, item?.id, item?.soundUri, item?.video, item?.soundMaxMs]);

  // Hard stop when viewer closes
  useEffect(() => {
    if (visible) return;
    void (async () => {
      try {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
      } catch {
        /* ignore */
      }
      soundRef.current = null;
      await stopStudioSound();
    })();
  }, [visible]);

  if (!item) return null;

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
    else onClose();
  };

  const goNext = () => {
    if (index < queue.length - 1) setIndex((i) => i + 1);
    else if (onFinishedPerson) onFinishedPerson();
    else onClose();
  };

  const holdPause = (on: boolean) => {
    paused.current = on;
  };

  const storyId = item.storyId || item.id;
  const loved = !!storyLikes[storyId];
  const productLines = item.productLabels?.length
    ? item.productLabels
    : item.productTags?.map((p) => p.name) || (item.product ? [item.product] : []);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {item.video ? (
          <LoopClip
            uri={videoUri || item.video}
            poster={item.media || ""}
            height={height}
            active={visible}
          />
        ) : item.media ? (
          <Image source={{ uri: item.media }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#1A0A14" }} />
        )}
        <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} edges={["top", "bottom"]} pointerEvents="box-none">
          <View style={{ paddingHorizontal: 10, paddingTop: 6, gap: 12 }} pointerEvents="box-none">
            <View style={{ flexDirection: "row", gap: 4 }}>
              {queue.map((row, i) => (
                <View key={`${row.id}-${i}`} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
                  <View style={{ height: "100%", backgroundColor: "#FFF8F4", width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {item.face ? (
                <Image source={{ uri: item.face }} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" }} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#70323E", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#FFF8F4" }}>{item.name.slice(0, 1)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: "#FFF8F4" }}>{item.name}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: "rgba(255,248,244,0.72)" }}>Unmask · 24h</Text>
              </View>
              <Pressable accessibilityLabel="Close stories" onPress={onClose} hitSlop={12}>
                <X size={22} color="#FFF8F4" />
              </Pressable>
            </View>
          </View>

          <View style={{ position: "absolute", left: 16, right: 16, top: 100, gap: 8 }} pointerEvents="none">
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "rgba(255,248,244,0.95)" }}>Unmask</Text>
            {item.momentBeat || item.stickers?.[0] ? (
              <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(74,21,44,0.88)" }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: "#FFF8F4" }}>
                  {item.momentBeat || item.stickers?.[0]}
                </Text>
              </View>
            ) : null}
            {item.momentTitle ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: "#FFF8F4", marginTop: 12 }}>{item.momentTitle}</Text>
            ) : item.occasion ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>{item.occasion}</Text>
            ) : null}
          </View>

          <View style={{ flex: 1, flexDirection: "row" }} pointerEvents="box-none">
            <Pressable style={{ flex: 1 }} onPress={goPrev} onPressIn={() => holdPause(true)} onPressOut={() => holdPause(false)} accessibilityLabel="Previous story" />
            <Pressable style={{ flex: 1 }} onPress={goNext} onPressIn={() => holdPause(true)} onPressOut={() => holdPause(false)} accessibilityLabel="Next story" />
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }} pointerEvents="box-none">
            {productLines.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {productLines.slice(0, 3).map((line, i) => (
                  <View
                    key={line}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      maxWidth: "100%",
                    }}
                  >
                    {item.productImages?.[i] ? (
                      <Image source={{ uri: item.productImages[i] }} style={{ width: 22, height: 22, borderRadius: 6 }} accessibilityIgnoresInvertColors />
                    ) : null}
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#FFF8F4" }} numberOfLines={1}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {[
                item.skinType
                  ? { key: "skin", label: /skin/i.test(item.skinType) ? item.skinType : `${item.skinType} Skin`, Icon: UserCircle }
                  : null,
                item.usageFrequency
                  ? { key: "usage", label: item.usageFrequency, Icon: ArrowClockwise }
                  : null,
                item.usageDuration
                  ? {
                      key: "duration",
                      label:
                        item.usageDuration.startsWith("Day") && !/of use/i.test(item.usageDuration)
                          ? `${item.usageDuration} of Use`
                          : item.usageDuration,
                      Icon: CalendarBlank,
                    }
                  : null,
                item.occasion ? { key: "routine", label: item.occasion, Icon: Sun } : null,
              ]
                .filter(Boolean)
                .map((chip) => {
                  const row = chip!;
                  return (
                    <View
                      key={row.key}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: "rgba(0,0,0,0.5)",
                      }}
                    >
                      <row.Icon size={12} color="#FFF8F4" />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#FFF8F4" }}>{row.label}</Text>
                    </View>
                  );
                })}
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: "#FFF8F4" }}>{item.caption}</Text>
            {interactive && item.storyId ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                <Pressable
                  accessibilityLabel="Like status"
                  onPress={() => {
                    hapticSelect();
                    toggleLike(storyId);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Heart size={26} color={loved ? "#FF6B9D" : "#FFF8F4"} weight={loved ? "fill" : "regular"} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>{item.likes}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Reshare to your status"
                  onPress={() => {
                    hapticSelect();
                    reshareStory(storyId, display);
                  }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#F0CF69" }}>Reshare</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Share outside Unmask"
                  onPress={() => {
                    hapticSelect();
                    void Share.share({ message: `${item.name} on Unmask: ${item.caption}`, url: item.video || item.media });
                  }}
                >
                  <ShareNetwork size={24} color="#FFF8F4" />
                </Pressable>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
