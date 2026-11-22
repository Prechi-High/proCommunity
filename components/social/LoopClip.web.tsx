import { createElement, useEffect, useRef, useState, type CSSProperties } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { Play, Pause, SpeakerHigh, SpeakerSlash } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { isMediaStoreUri, resolvePlayableUri } from "@/lib/moment/mediaBlobStore";
import { usePageActive } from "@/lib/usePageActive";

function isPlayableSrc(uri: string | undefined | null): boolean {
  if (!uri) return false;
  if (isMediaStoreUri(uri)) return false;
  return (
    uri.startsWith("blob:") ||
    uri.startsWith("data:") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("file:")
  );
}

/**
 * Web video — muted autoplay by default; optional feed controls (play/pause, mute).
 * Resolves durable `unmask-media:` keys before setting `src`. Never treats poster as the post.
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
  /** Show play/pause + mute for feed cards. */
  controls?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pageActive = usePageActive();
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  const live = active && pageActive && !paused;
  const still =
    poster && isPlayableSrc(poster) && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(poster) ? poster : "";

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setReady(false);
    setSrc("");
    setPaused(false);
    setMuted(true);
    if (!uri) return;
    void (async () => {
      try {
        const next = await resolvePlayableUri(uri);
        if (cancelled) return;
        if (isPlayableSrc(next)) setSrc(next);
        else if (isPlayableSrc(uri)) setSrc(uri);
        else setFailed(true);
      } catch {
        if (!cancelled) {
          if (isPlayableSrc(uri)) setSrc(uri);
          else setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;

    const arm = () => {
      el.muted = muted;
      el.defaultMuted = true;
      el.volume = muted ? 0 : 1;
      el.playsInline = true;
      el.autoplay = true;
      el.loop = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.setAttribute("autoplay", "");
      if (muted) el.setAttribute("muted", "");
      else el.removeAttribute("muted");
    };

    const play = () => {
      arm();
      if (!live) {
        el.pause();
        return;
      }
      const p = el.play();
      if (p && typeof p.then === "function") {
        void p.then(
          () => setReady(true),
          () => undefined,
        );
      }
    };

    arm();
    el.addEventListener("loadeddata", play);
    el.addEventListener("canplay", play);
    el.addEventListener("canplaythrough", play);
    play();

    const retry = window.setInterval(() => {
      if (!live) return;
      if (el.paused) play();
    }, 350);

    return () => {
      el.removeEventListener("loadeddata", play);
      el.removeEventListener("canplay", play);
      el.removeEventListener("canplaythrough", play);
      window.clearInterval(retry);
      el.pause();
    };
  }, [src, live, muted]);

  if (failed && still) {
    return (
      <Image
        source={{ uri: still }}
        style={{ width: "100%", height }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  if (failed || (!src && !still)) {
    return <View style={{ width: "100%", height, backgroundColor: "#120810" }} />;
  }

  return (
    <View style={{ width: "100%", height, backgroundColor: "#120810", overflow: "hidden" }}>
      {!ready && still ? (
        <Image
          source={{ uri: still }}
          style={{ position: "absolute", width: "100%", height: "100%", zIndex: 1 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {src
        ? createElement("video", {
            key: src,
            ref: videoRef,
            src,
            muted,
            defaultMuted: true,
            autoPlay: true,
            playsInline: true,
            loop: true,
            preload: "auto",
            poster: still || undefined,
            controls: false,
            "webkit-playsinline": "true",
            onLoadedData: () => setReady(true),
            onPlaying: () => setReady(true),
            onError: () => setFailed(true),
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              backgroundColor: "#120810",
            } as CSSProperties,
          })
        : null}

      {controls ? (
        <View
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            flexDirection: "row",
            gap: 8,
            zIndex: 2,
          }}
          pointerEvents="box-none"
        >
          <Pressable
            accessibilityLabel={paused ? "Play video" : "Pause video"}
            onPress={() => setPaused((p) => !p)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.55)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {paused ? <Play size={18} color="#FFF8F4" weight="fill" /> : <Pause size={18} color="#FFF8F4" weight="fill" />}
          </Pressable>
          <Pressable
            accessibilityLabel={muted ? "Unmute video" : "Mute video"}
            onPress={() => setMuted((m) => !m)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.55)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {muted ? <SpeakerSlash size={18} color="#FFF8F4" /> : <SpeakerHigh size={18} color="#FFF8F4" />}
          </Pressable>
        </View>
      ) : null}

      {controls && paused ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>Paused</Text>
        </View>
      ) : null}
    </View>
  );
}
