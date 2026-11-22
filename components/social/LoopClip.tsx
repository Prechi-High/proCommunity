import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
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

export type LoopClipHandle = {
  unmute: () => void;
  mute: () => void;
  isMuted: () => boolean;
};

/**
 * Always autoplay muted first (reliable). Sound only after an explicit unmute tap
 * from StoryViewer — never fight the browser with unmuted autoplay loops.
 */
export function LoopClip({
  uri,
  poster,
  height,
  active = true,
  controls = false,
  muted: mutedProp,
  onMutedChange,
  clipRef,
}: {
  uri: string;
  poster: string;
  height: number;
  active?: boolean;
  controls?: boolean;
  /** @deprecated kept for call-site compat — sound is via muted/unmute only */
  playSound?: boolean;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  clipRef?: MutableRefObject<LoopClipHandle | null>;
}) {
  if (Platform.OS === "web") {
    return (
      <WebLoopClip
        uri={uri}
        poster={poster}
        height={height}
        active={active}
        controls={controls}
        mutedProp={mutedProp}
        onMutedChange={onMutedChange}
        clipRef={clipRef}
      />
    );
  }
  return (
    <NativeLoopClip
      uri={uri}
      poster={poster}
      height={height}
      active={active}
      mutedProp={mutedProp}
      onMutedChange={onMutedChange}
      clipRef={clipRef}
    />
  );
}

function WebLoopClip({
  uri,
  poster,
  height,
  active,
  controls,
  mutedProp,
  onMutedChange,
  clipRef,
}: {
  uri: string;
  poster: string;
  height: number;
  active: boolean;
  controls: boolean;
  mutedProp?: boolean;
  onMutedChange?: (muted: boolean) => void;
  clipRef?: MutableRefObject<LoopClipHandle | null>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pageActive = usePageActive();
  const startedRef = useRef(false);
  const mutedRef = useRef(true);
  const [src, setSrc] = useState("");
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [internalMuted, setInternalMuted] = useState(true);
  const [resolveError, setResolveError] = useState<"missing" | "not_video" | "unresolved" | "">("");

  const muted = typeof mutedProp === "boolean" ? mutedProp : internalMuted;
  mutedRef.current = muted;
  const live = active && pageActive && !paused;
  const still =
    poster && !isMediaStoreUri(poster) && (isImageUri(poster) || poster.startsWith("blob:") || poster.startsWith("data:image"))
      ? poster
      : "";

  const setMuted = (next: boolean) => {
    if (typeof mutedProp !== "boolean") setInternalMuted(next);
    onMutedChange?.(next);
  };

  useEffect(() => {
    let cancelled = false;
    startedRef.current = false;
    setReady(false);
    setSrc("");
    setResolveError("");
    setPaused(false);
    if (typeof mutedProp !== "boolean") setInternalMuted(true);
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

  const applyMuteDom = (el: HTMLVideoElement, wantMuted: boolean) => {
    el.muted = wantMuted;
    el.defaultMuted = wantMuted;
    el.volume = wantMuted ? 0 : 1;
    if (wantMuted) el.setAttribute("muted", "");
    else {
      el.removeAttribute("muted");
      el.muted = false;
      el.volume = 1;
    }
  };

  const unmuteNow = () => {
    const el = videoRef.current;
    setMuted(false);
    if (!el) return;
    applyMuteDom(el, false);
    void el.play().catch(() => {
      // If unmute play fails, stay muted rather than thrashing
      applyMuteDom(el, true);
      setMuted(true);
      void el.play().catch(() => undefined);
    });
  };

  const muteNow = () => {
    const el = videoRef.current;
    setMuted(true);
    if (!el) return;
    applyMuteDom(el, true);
  };

  useEffect(() => {
    if (!clipRef) return;
    clipRef.current = {
      unmute: unmuteNow,
      mute: muteNow,
      isMuted: () => muted,
    };
    return () => {
      clipRef.current = null;
    };
  });

  // Start once, muted — do not re-enter on mute toggles
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      startedRef.current = true;
      setReady(true);
    };

    const kickPlay = () => {
      if (cancelled || !live) {
        if (!cancelled && !live) el.pause();
        return;
      }
      el.playsInline = true;
      el.loop = true;
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      // Only force mute on the very first start — later canplay must not remute.
      if (!startedRef.current) applyMuteDom(el, true);
      else applyMuteDom(el, mutedRef.current);
      void el.play().then(markReady).catch(() => undefined);
    };

    if (el.getAttribute("data-src") !== src) {
      el.setAttribute("data-src", src);
      startedRef.current = false;
      el.src = src;
      el.load();
    }

    el.addEventListener("loadeddata", kickPlay);
    el.addEventListener("canplay", kickPlay);
    el.addEventListener("playing", markReady);
    kickPlay();

    // Soft resume only if stalled after we already started
    const retry = window.setInterval(() => {
      if (cancelled || !live || !startedRef.current || !el.paused) return;
      applyMuteDom(el, mutedRef.current);
      void el.play().catch(() => undefined);
    }, 1000);

    return () => {
      cancelled = true;
      el.removeEventListener("loadeddata", kickPlay);
      el.removeEventListener("canplay", kickPlay);
      el.removeEventListener("playing", markReady);
      window.clearInterval(retry);
      el.pause();
    };
    // intentionally not depending on muted — unmute is handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, live]);

  // Mute toggles only change volume flags — never reload src
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !startedRef.current) return;
    applyMuteDom(el, muted);
    if (live && el.paused) void el.play().catch(() => undefined);
  }, [muted, live]);

  return (
    <View style={{ width: "100%", height, backgroundColor: "#120810", overflow: "hidden" }}>
      {src
        ? createElement("video", {
            ref: (node: HTMLVideoElement | null) => {
              videoRef.current = node;
              // Set muted only on attach — do NOT pass React `muted` prop.
              // StoryViewer re-renders ~12×/s for progress; React would remute
              // the element every tick and stall / restart buffering forever.
              if (node && !node.getAttribute("data-mute-init")) {
                node.setAttribute("data-mute-init", "1");
                applyMuteDom(node, true);
              }
            },
            src,
            // Intentionally omit `muted` — managed via applyMuteDom / unmuteNow only
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
        <View
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
          pointerEvents="none"
        >
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
        <View style={{ position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 8, zIndex: 3 }}>
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
            onPress={() => (muted ? unmuteNow() : muteNow())}
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
    </View>
  );
}

function NativeLoopClip({
  uri,
  poster,
  height,
  active,
  mutedProp,
  onMutedChange,
  clipRef,
}: {
  uri: string;
  poster: string;
  height: number;
  active: boolean;
  mutedProp?: boolean;
  onMutedChange?: (muted: boolean) => void;
  clipRef?: MutableRefObject<LoopClipHandle | null>;
}) {
  const ref = useRef<Video>(null);
  const pageActive = usePageActive();
  const live = active && pageActive;
  const still = poster && isImageUri(poster) ? poster : "";
  const [internalMuted, setInternalMuted] = useState(true);
  const muted = typeof mutedProp === "boolean" ? mutedProp : internalMuted;

  useEffect(() => {
    if (!clipRef) return;
    clipRef.current = {
      unmute: () => {
        setInternalMuted(false);
        onMutedChange?.(false);
        void ref.current?.setIsMutedAsync(false).then(() => ref.current?.setVolumeAsync(1)).then(() => ref.current?.playAsync());
      },
      mute: () => {
        setInternalMuted(true);
        onMutedChange?.(true);
        void ref.current?.setIsMutedAsync(true);
      },
      isMuted: () => muted,
    };
    return () => {
      clipRef.current = null;
    };
  });

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
        await v.setIsMutedAsync(muted);
        await v.setVolumeAsync(muted ? 0 : 1);
        await v.playAsync();
      } catch {
        if (cancelled) return;
        try {
          await v.setIsMutedAsync(true);
          await v.playAsync();
        } catch {
          /* keep trying quietly */
        }
      }
    };
    void kick();
    const t = setInterval(() => void kick(), 1200);
    return () => {
      cancelled = true;
      clearInterval(t);
      void v.pauseAsync().catch(() => undefined);
    };
  }, [live, uri, muted]);

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
        isMuted={muted}
        volume={muted ? 0 : 1}
        resizeMode={ResizeMode.COVER}
        useNativeControls={false}
        style={{ width: "100%", height }}
      />
    </View>
  );
}
