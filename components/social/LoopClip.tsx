import { useState } from "react";
import { Image, View } from "react-native";
import { Video, ResizeMode } from "expo-av";

export function LoopClip({
  uri,
  poster,
  height,
}: {
  uri: string;
  poster: string;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  const still = poster && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(poster) ? poster : "";
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
        key={uri}
        source={{ uri }}
        posterSource={still ? { uri: still } : undefined}
        usePoster={Boolean(still)}
        isLooping
        shouldPlay
        isMuted
        resizeMode={ResizeMode.COVER}
        useNativeControls={false}
        onError={() => setFailed(true)}
        style={{ width: "100%", height }}
      />
    </View>
  );
}
