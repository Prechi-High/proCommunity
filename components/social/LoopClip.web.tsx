import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";

/**
 * Web video player — expo-av is unreliable with blob: URLs on mobile browsers
 * (black frame / no playback). Native HTML5 video works for blob/http/https.
 */
export function LoopClip({
  uri,
  poster,
  height,
}: {
  uri: string;
  poster: string;
  height: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFailed(false);
    setReady(false);
    const el = videoRef.current;
    if (!el || !uri) return;
    el.pause();
    el.src = uri;
    el.load();
    const tryPlay = () => {
      void el.play().catch(() => {
        /* autoplay may require mute — already muted */
      });
    };
    el.addEventListener("loadeddata", tryPlay);
    el.addEventListener("canplay", tryPlay);
    return () => {
      el.removeEventListener("loadeddata", tryPlay);
      el.removeEventListener("canplay", tryPlay);
      el.pause();
    };
  }, [uri]);

  const still = poster && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(poster) ? poster : "";

  if (failed) {
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
    <View style={{ width: "100%", height, backgroundColor: "#120810", overflow: "hidden" }}>
      {!ready && still ? (
        <Image
          source={{ uri: still }}
          style={{ position: "absolute", width: "100%", height: "100%" }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
        poster={still || undefined}
        onLoadedData={() => setReady(true)}
        onPlaying={() => setReady(true)}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          backgroundColor: "#120810",
        }}
      />
    </View>
  );
}
