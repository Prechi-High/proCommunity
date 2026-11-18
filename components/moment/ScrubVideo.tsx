import { useCallback, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";

import { Pause, Play } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { formatDuration } from "@/lib/moment/mediaLimits";

export function ScrubVideo({
  uri,
  poster,
  onPositionMs,
}: {
  uri: string;
  poster?: string;
  onPositionMs?: (ms: number) => void;
}) {
  const ref = useRef<Video>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [barW, setBarW] = useState(1);

  const onStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      setPlaying(status.isPlaying);
      setPositionMs(status.positionMillis);
      if (status.durationMillis) setDurationMs(status.durationMillis);
      onPositionMs?.(status.positionMillis);
    },
    [onPositionMs],
  );

  const togglePlay = async () => {
    const v = ref.current;
    if (!v) return;
    if (playing) await v.pauseAsync();
    else await v.playAsync();
  };

  const seekRatio = async (ratio: number) => {
    const v = ref.current;
    if (!v || !durationMs) return;
    const next = Math.max(0, Math.min(durationMs, ratio * durationMs));
    await v.setPositionAsync(next);
    setPositionMs(next);
    onPositionMs?.(next);
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#120810" }}>
      <Video
        ref={ref}
        source={{ uri }}
        posterSource={poster ? { uri: poster } : undefined}
        usePoster={!!poster}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        isLooping={false}
        onPlaybackStatusUpdate={onStatus}
        style={{ flex: 1, width: "100%" }}
      />
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => void togglePlay()}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}
          >
            {playing ? <Pause size={20} color="#FFF8F4" weight="fill" /> : <Play size={20} color="#FFF8F4" weight="fill" />}
          </Pressable>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "#FFF8F4" }}>
            {formatDuration(positionMs)} / {formatDuration(durationMs)}
          </Text>
        </View>
        <Pressable
          onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)}
          onPress={(e) => {
            const x = e.nativeEvent.locationX;
            void seekRatio(x / barW);
          }}
          style={{ height: 28, justifyContent: "center" }}
        >
          <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }}>
            <View style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: "#FF6B9D" }} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}