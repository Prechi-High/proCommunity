import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { Video, ResizeMode } from "expo-av";

import { usePageActive } from "@/lib/usePageActive";

export function LoopClip({
  uri,
  poster,
  height,
  active = true,
}: {
  uri: string;
  poster: string;
  height: number;
  active?: boolean;
}) {
  const ref = useRef<Video>(null);
  const pageActive = usePageActive();
  const live = active && pageActive;
  const [failed, setFailed] = useState(false);
  const still = poster && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(poster) ? poster : "";

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (live) void v.playAsync().catch(() => setFailed(true));
    else void v.pauseAsync().catch(() => undefined);
  }, [live]);

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
