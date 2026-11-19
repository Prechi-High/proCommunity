import { createElement, useEffect, useRef, useState, type CSSProperties } from "react";
import { Image, View } from "react-native";

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
 * Web video — muted autoplay everywhere (preview, status, feed).
 * Resolves durable `unmask-media:` keys before setting `src`.
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
  active?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pageActive = usePageActive();
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const live = active && pageActive;
  const still =
    poster && isPlayableSrc(poster) && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(poster) ? poster : "";

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setReady(false);
    setSrc("");
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

  // Keep forcing muted autoplay while the clip should be live
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;

    const arm = () => {
      el.muted = true;
      el.defaultMuted = true;
      el.volume = 0;
      el.playsInline = true;
      el.autoplay = true;
      el.loop = true;
      el.setAttribute("muted", "");
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.setAttribute("autoplay", "");
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
  }, [src, live]);

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
            muted: true,
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
    </View>
  );
}
