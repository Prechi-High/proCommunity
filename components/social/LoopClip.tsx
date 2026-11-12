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
  if (failed) {
    return (
      <Image
        source={{ uri: poster }}
        style={{ width: "100%", height }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={{ width: "100%", height, backgroundColor: "#120810" }}>
      <Video
        source={{ uri }}
        posterSource={{ uri: poster }}
        usePoster
        isLooping
        shouldPlay
        isMuted
        resizeMode={ResizeMode.COVER}
        onError={() => setFailed(true)}
        style={{ width: "100%", height }}
      />
    </View>
  );
}
