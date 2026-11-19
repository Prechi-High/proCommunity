import { createElement, useEffect, useRef, useState, type CSSProperties } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { Play } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { resolvePlayableUri } from "@/lib/moment/mediaBlobStore";
import { usePageActive } from "@/lib/usePageActive";

/**
 * Web video — mount a real HTMLVideoElement, force muted for autoplay,
 * resolve durable unmask-media: URIs from IndexedDB, pause when the tab hides.
 */
export function LoopClip({
  uri,
  poster,
  height,
  active = true,
}: {
  uri: string;
  poster: string;
  height: number;
  /** When false, pause (e.g. story closed or tab hidden). */
  active?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pageActive = usePageActive();
  const live = active && pageActive;
  const [playable, setPlayable] = useState(uri);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  const still =
    poster && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(poster) && !poster.startsWith("unmask-media:")
      ? poster
      : "";

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setReady(false);
    setNeedsTap(false);
    void (async () => {
      try {
        const next = await resolvePlayableUri(uri);
        if (!cancelled) setPlayable(next || uri);
      } catch {
        if (!cancelled) setPlayable(uri);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !playable) return;

    // React's `muted` prop is unreliable for autoplay policy — set the DOM property.
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.loop = true;
    el.preload = "auto";

    if (el.getAttribute("src") !== playable && el.src !== playable) {
      el.src = playable;
      el.load();
    }

    const tryPlay = () => {
      if (!live) {
        el.pause();
        return;
      }
      el.muted = true;
      void el.play().then(
        () => {
          setNeedsTap(false);
          setReady(true);
        },
        () => setNeedsTap(true),
      );
    };

    el.addEventListener("loadeddata", tryPlay);
    el.addEventListener("canplay", tryPlay);
    tryPlay();

    return () => {
      el.removeEventListener("loadeddata", tryPlay);
      el.removeEventListener("canplay", tryPlay);
      el.pause();
    };
  }, [playable, live]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!live) el.pause();
    else if (!needsTap) {
      el.muted = true;
      void el.play().catch(() => setNeedsTap(true));
    }
  }, [live, needsTap]);

  // Story overlays often sit above this player — any user gesture in the page can unlock autoplay.
  useEffect(() => {
    if (!needsTap || !live || typeof document === "undefined") return;
    const kick = () => {
      const el = videoRef.current;
      if (!el) return;
      el.muted = true;
      void el.play().then(
        () => {
          setNeedsTap(false);
          setReady(true);
        },
        () => undefined,
      );
    };
    document.addEventListener("pointerdown", kick, true);
    document.addEventListener("touchstart", kick, true);
    return () => {
      document.removeEventListener("pointerdown", kick, true);
      document.removeEventListener("touchstart", kick, true);
    };
  }, [needsTap, live]);

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
      {createElement("video", {
        ref: videoRef,
        muted: true,
        autoPlay: true,
        playsInline: true,
        loop: true,
        preload: "auto",
        poster: still || undefined,
        controls: false,
        onLoadedData: () => setReady(true),
        onPlaying: () => {
          setReady(true);
          setNeedsTap(false);
        },
        onError: () => setFailed(true),
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          backgroundColor: "#120810",
        } as CSSProperties,
      })}
      {needsTap ? (
        <Pressable
          accessibilityLabel="Play video"
          onPress={() => {
            const el = videoRef.current;
            if (!el) return;
            el.muted = true;
            void el.play().then(
              () => {
                setNeedsTap(false);
                setReady(true);
              },
              () => setFailed(true),
            );
          }}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={28} color="#1A0A14" weight="fill" />
          </View>
          <Text style={{ marginTop: 10, fontFamily: fonts.semibold, fontSize: 13, color: "#FFF8F4" }}>
            Tap to play
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
