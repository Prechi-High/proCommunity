import { createElement, useEffect, useRef, useState, type CSSProperties } from "react";
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from "react-native";
import { Video, ResizeMode } from "expo-av";

import { Pause, Play, SpeakerHigh, SpeakerSlash } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { isMediaStoreUri, resolvePlayableUri } from "@/lib/moment/mediaBlobStore";
import { usePageActive } from "@/lib/usePageActive";

function isImageUri(uri: string | undefined | null): boolean {
  if (!uri) return false;
  if (uri.startsWith("data:image")) return true;
  return /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(uri);
}

function isPlayableVideoSrc(uri: string | undefined | null): boolean {
  if (!uri || isMediaStoreUri(uri) || isImageUri(uri)) return false;
  return (
    uri.startsWith("blob:") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("file:") ||
    uri.startsWith("data:video")
  );
}

/**
 * Status / feed video.
 * Never permanently replace video with <Image> — that made status look like a photo.
 */
export function LoopClip({
  uri,
  poster,
  height,
  active = true,
  controls = false,
}: {
  uri: string;
  poster: string;
  height: number;
  active?: boolean;
  controls?: boolean;
}) {
  if (Platform.OS === "web") {
    return <WebLoopClip uri={uri} poster={poster} height={height} active={active} controls={controls} />;
  }
  return <NativeLoopClip uri={uri} poster={poster} height={height} active={active} />;
}

function WebLoopClip({
  uri,
  poster,
  height,
  active,
  controls,
}: {
  uri: string;
  poster: string;
  height: number;
  active: boolean;
  controls: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pageActive = usePageActive();
  const [src, setSrc] = useState("");
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [resolveError, setResolveError] = useState<"missing" | "not_video" | "unresolved" | "">("");

  const live = active && pageActive && !paused;
  const still =
    poster && !isMediaStoreUri(poster) && (isImageUri(poster) || poster.startsWith("blob:") || poster.startsWith("data:image"))
      ? poster
      : "";

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setSrc("");
    setResolveError("");
    setPaused(false);
    setMuted(true);
    if (!uri) {
      setResolveError("missing");
      return;
    }
    if (isImageUri(uri)) {
      setResolveError("not_video");
      return;
    }
    void (async () => {
      try {
        const next = await resolvePlayableUri(uri);
        if (cancelled) return;
        if (isPlayableVideoSrc(next)) setSrc(next);
        else if (isPlayableVideoSrc(uri)) setSrc(uri);
        else setResolveError("unresolved");
      } catch {
        if (cancelled) return;
        if (isPlayableVideoSrc(uri)) setSrc(uri);
        else setResolveError("unresolved");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;

    const playMuted = () => {
      el.muted = true;
      el.defaultMuted = true;
      el.volume = 0;
      el.playsInline = true;
      el.autoplay = true;
      el.loop = true;
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.setAttribute("muted", "");
      el.setAttribute("autoplay", "");
      if (!live) {
        el.pause();
        return;
      }
      void el.play().then(
        () => {
          setReady(true);
          if (!muted) {
            el.muted = false;
            el.volume = 1;
          }
        },
        () => {
          el.muted = true;
          void el.play().then(() => setReady(true)).catch(() => undefined);
        },
      );
    };

    if (el.getAttribute("data-src") !== src) {
      el.setAttribute("data-src", src);
      el.src = src;
      el.load();
    }
    el.addEventListener("loadeddata", playMuted);
    el.addEventListener("canplay", playMuted);
    el.addEventListener("playing", () => setReady(true));
    playMuted();

    const retry = window.setInterval(() => {
      if (live && el.paused) playMuted();
    }, 250);

    return () => {
      el.removeEventListener("loadeddata", playMuted);
      el.removeEventListener("canplay", playMuted);
      window.clearInterval(retry);
      el.pause();
    };
  }, [src, live, muted]);

  return (
    <View style={{ width: "100%", height, backgroundColor: "#120810", overflow: "hidden" }}>
      {src
        ? createElement("video", {
            ref: videoRef,
            src,
            muted: true,
            defaultMuted: true,
            autoPlay: true,
            playsInline: true,
            loop: true,
            preload: "auto",
            poster: still || undefined,
            controls: false,
            "webkit-playsinline": "true",
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              backgroundColor: "#120810",
            } as CSSProperties,
          })
        : null}

      {/* Temporary poster only — removed once video is playing (never the permanent renderer) */}
      {!ready && still ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          <Image
            source={{ uri: still }}
            style={{ width: "100%", height: "100%", opacity: src ? 0.9 : 1 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      {!ready && !resolveError ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
          <ActivityIndicator color="#FFF8F4" />
        </View>
      ) : null}

      {resolveError ? (
        <View style={{ position: "absolute", left: 16, right: 16, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#FFF8F4", textAlign: "center", lineHeight: 20 }}>
            {resolveError === "not_video"
              ? "This status was saved as a photo. Upload the video again to play it."
              : "Video couldn’t load. Close status and open it again, or re-upload."}
          </Text>
        </View>
      ) : null}

      {controls ? (
        <View style={{ position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 8 }}>
          <Pressable
            accessibilityLabel={paused ? "Play video" : "Pause video"}
            onPress={() => setPaused((p) => !p)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
          >
            {paused ? <Play size={18} color="#FFF8F4" weight="fill" /> : <Pause size={18} color="#FFF8F4" weight="fill" />}
          </Pressable>
          <Pressable
            accessibilityLabel={muted ? "Unmute video" : "Mute video"}
            onPress={() => setMuted((m) => !m)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
          >
            {muted ? <SpeakerSlash size={18} color="#FFF8F4" /> : <SpeakerHigh size={18} color="#FFF8F4" />}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function NativeLoopClip({
  uri,
  poster,
  height,
  active,
}: {
  uri: string;
  poster: string;
  height: number;
  active: boolean;
}) {
  const ref = useRef<Video>(null);
  const pageActive = usePageActive();
  const live = active && pageActive;
  const still = poster && isImageUri(poster) ? poster : "";

  useEffect(() => {
    const v = ref.current;
    if (!v || !uri || isImageUri(uri)) return;
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
        if (!cancelled) {
          /* keep retrying — do not swap to Image */
        }
      }
    };
    void kick();
    const t = setInterval(() => void kick(), 600);
    return () => {
      cancelled = true;
      clearInterval(t);
      void v.pauseAsync().catch(() => undefined);
    };
  }, [live, uri]);

  if (!uri || isImageUri(uri)) {
    return (
      <View style={{ width: "100%", height, backgroundColor: "#120810", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {still ? (
          <Image
            source={{ uri: still }}
            style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.5 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#FFF8F4", textAlign: "center" }}>
          Re-upload the video to play this status.
        </Text>
      </View>
    );
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
        style={{ width: "100%", height }}
      />
    </View>
  );
}
