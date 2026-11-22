import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { Video, ResizeMode } from "expo-av";

import { usePageActive } from "@/lib/usePageActive";

/** Native / default: muted looping autoplay whenever the clip is active. */
export function LoopClip({
  uri,
  poster,
  height,
  active = true,
  controls: _controls = false,
}: {
  uri: string;
  poster: string;
  height: number;
  active?: boolean;
  controls?: boolean;
}) {
  const ref = useRef<Video>(null);
  const pageActive = usePageActive();
  const live = active && pageActive;
  const [failed, setFailed] = useState(false);
  const still = poster && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(poster) ? poster : "";

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !uri) return;
    let cancelled = false;
    const kick = async () => {
      try {
        if (!live) {
          await v.pauseAsync();
          return;
        }
        await v.setIsMutedAsync(true);
        await v.playAsync();
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void kick();
    const t = setInterval(() => {
      void kick();
    }, 800);
    return () => {
      cancelled = true;
      clearInterval(t);
      void v.pauseAsync().catch(() => undefined);
    };
  }, [live, uri]);

  if (failed || !uri) {
    if (still) {
      return (
        <Image
          source={{ uri: still }}
          style={{ width: "100%", height }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      );
    }
    return <View style={{ width: "100%", height, backgroundColor: "#120810" }} />;
  }

  return (
    <View style={{ width: "100%", height, backgroundColor: "#120810" }}>
      <Video
        ref={ref}
        key={uri}
        source={{ uri }}
        posterSource={still ? { uri: still } : undefined}
        usePoster={Boolean(still)}
        isLooping
        shouldPlay={live}
        isMuted
        resizeMode={ResizeMode.COVER}
        useNativeControls={false}
        onError={() => setFailed(true)}
        style={{ width: "100%", height }}
      />
    </View>
  );
}
