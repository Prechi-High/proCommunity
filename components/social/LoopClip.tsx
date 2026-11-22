import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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

function hostDom(node: unknown): HTMLElement | null {
  if (!node || typeof document === "undefined") return null;
  if (node instanceof HTMLElement) return node;
  const anyNode = node as { _nativeNode?: HTMLElement; getNode?: () => HTMLElement };
  if (anyNode._nativeNode instanceof HTMLElement) return anyNode._nativeNode;
  if (typeof anyNode.getNode === "function") {
    const n = anyNode.getNode();
    if (n instanceof HTMLElement) return n;
  }
  return null;
}

export type LoopClipHandle = {
  unmute: () => void;
  mute: () => void;
  isMuted: () => boolean;
};

/**
 * Status / feed video. On web the <video> is mounted imperatively into a host
 * div so StoryViewer progress re-renders (~12/s) never remount or remute it.
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
  /** @deprecated kept for call-site compat */
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

function applyMuteDom(el: HTMLVideoElement, wantMuted: boolean) {
  el.muted = wantMuted;
  el.defaultMuted = wantMuted;
  el.volume = wantMuted ? 0 : 1;
  if (wantMuted) el.setAttribute("muted", "");
  else {
    el.removeAttribute("muted");
    el.muted = false;
    el.volume = 1;
  }
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
  const hostRef = useRef<View>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mountedSrcRef = useRef("");
  const mutedRef = useRef(true);
  const liveRef = useRef(true);
  const pageActive = usePageActive();
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [internalMuted, setInternalMuted] = useState(true);
  const [resolveError, setResolveError] = useState<"missing" | "not_video" | "unresolved" | "">("");
  const [hostReady, setHostReady] = useState(false);

  const muted = typeof mutedProp === "boolean" ? mutedProp : internalMuted;
  mutedRef.current = muted;
  const live = active && pageActive && !paused;
  liveRef.current = live;

  const still =
    poster && !isMediaStoreUri(poster) && (isImageUri(poster) || poster.startsWith("blob:") || poster.startsWith("data:image"))
      ? poster
      : "";

  const setMuted = (next: boolean) => {
    if (typeof mutedProp !== "boolean") setInternalMuted(next);
    onMutedChange?.(next);
  };

  const markReady = () => setReady(true);

  const kickPlay = (el: HTMLVideoElement) => {
    if (!liveRef.current) {
      el.pause();
      return;
    }
    // Always attempt muted first for autoplay; respect unmute after started.
    if (el.paused || el.ended) {
      if (mutedRef.current) applyMuteDom(el, true);
      void el.play().then(markReady).catch(() => {
        applyMuteDom(el, true);
        void el.play().then(markReady).catch(() => undefined);
      });
    } else {
      markReady();
    }
  };

  // Imperative <video> — never owned by React createElement
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    let el = videoRef.current;
    let tries = 0;
    let raf = 0;
    let timer = 0;

    const attach = () => {
      const host = hostDom(hostRef.current);
      if (!host) {
        if (tries++ < 60) {
          raf = requestAnimationFrame(attach);
          return;
        }
        setResolveError("unresolved");
        return;
      }
      if (el && el.parentElement === host) {
        setHostReady(true);
        return;
      }
      el = document.createElement("video");
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.setAttribute("muted", "");
      el.muted = true;
      el.defaultMuted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.loop = true;
      el.preload = "auto";
      el.controls = false;
      el.style.cssText =
        "width:100%;height:100%;object-fit:cover;display:block;background:#120810;position:absolute;inset:0;z-index:0;";
      host.appendChild(el);
      videoRef.current = el;
      setHostReady(true);
    };

    attach();
    // Extra delayed retry — RN-web sometimes hydrates the host a tick later
    timer = window.setTimeout(attach, 50);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      const node = videoRef.current;
      if (node) {
        try {
          node.pause();
          node.removeAttribute("src");
          node.load();
          node.remove();
        } catch {
          /* ignore */
        }
      }
      videoRef.current = null;
      mountedSrcRef.current = "";
    };
  }, []);

  // Resolve durable URI and assign src without React remounts
  useEffect(() => {
    if (!hostReady) return;
    let cancelled = false;
    let failsafe = 0;
    let onFrame: (() => void) | null = null;
    let boundEl: HTMLVideoElement | null = null;

    const detach = () => {
      if (failsafe) window.clearTimeout(failsafe);
      failsafe = 0;
      if (boundEl && onFrame) {
        boundEl.removeEventListener("loadeddata", onFrame);
        boundEl.removeEventListener("canplay", onFrame);
        boundEl.removeEventListener("playing", onFrame);
      }
      onFrame = null;
      boundEl = null;
    };

    setResolveError("");
    setPaused(false);

    if (!uri) {
      setResolveError("missing");
      setReady(false);
      return;
    }
    if (isImageUri(uri)) {
      setResolveError("not_video");
      setReady(false);
      return;
    }

    void (async () => {
      let next = "";
      try {
        const resolved = await resolvePlayableUri(uri);
        if (isPlayableVideoSrc(resolved)) next = resolved;
        else if (isPlayableVideoSrc(uri)) next = uri;
      } catch {
        if (isPlayableVideoSrc(uri)) next = uri;
      }
      if (cancelled) return;
      if (!next) {
        setResolveError("unresolved");
        setReady(false);
        return;
      }

      const el = videoRef.current;
      if (!el) {
        setResolveError("unresolved");
        return;
      }

      // Same playable URL already mounted — don't reload / don't flash spinner
      if (mountedSrcRef.current === next && (el.currentSrc || el.src)) {
        if (el.readyState >= 2) markReady();
        kickPlay(el);
        return;
      }

      setReady(false);
      mountedSrcRef.current = next;
      boundEl = el;

      onFrame = () => {
        if (cancelled) return;
        markReady();
        kickPlay(el);
      };

      el.addEventListener("loadeddata", onFrame);
      el.addEventListener("canplay", onFrame);
      el.addEventListener("playing", onFrame);
      el.addEventListener(
        "error",
        () => {
          if (!cancelled) setResolveError("unresolved");
        },
        { once: true },
      );

      applyMuteDom(el, true);
      const posterUri =
        poster && !isMediaStoreUri(poster) && (isImageUri(poster) || poster.startsWith("blob:") || poster.startsWith("data:image"))
          ? poster
          : "";
      if (posterUri) el.setAttribute("poster", posterUri);
      else el.removeAttribute("poster");
      el.src = next;
      el.load();
      kickPlay(el);

      failsafe = window.setTimeout(() => {
        if (cancelled) return;
        if (el.readyState >= 2) markReady();
      }, 2500);
    })();

    return () => {
      cancelled = true;
      detach();
    };
  }, [uri, hostReady, poster]);

  // Pause / resume with visibility — never reload src
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !mountedSrcRef.current) return;
    if (!live) {
      el.pause();
      return;
    }
    kickPlay(el);
    const retry = window.setInterval(() => {
      if (!liveRef.current || !el.paused) return;
      kickPlay(el);
    }, 800);
    return () => window.clearInterval(retry);
  }, [live]);

  // External mute toggles
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !mountedSrcRef.current) return;
    applyMuteDom(el, muted);
    if (!muted && live) void el.play().catch(() => undefined);
  }, [muted, live]);

  useEffect(() => {
    if (!clipRef) return;
    clipRef.current = {
      unmute: () => {
        setMuted(false);
        const el = videoRef.current;
        if (!el) return;
        applyMuteDom(el, false);
        void el.play().catch(() => {
          applyMuteDom(el, true);
          setMuted(true);
        });
      },
      mute: () => {
        setMuted(true);
        const el = videoRef.current;
        if (el) applyMuteDom(el, true);
      },
      isMuted: () => mutedRef.current,
    };
    return () => {
      clipRef.current = null;
    };
  });

  return (
    <View style={{ width: "100%", height, backgroundColor: "#120810", overflow: "hidden" }}>
      <View
        ref={hostRef}
        collapsable={false}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {!ready && still ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          <Image
            source={{ uri: still }}
            style={{ width: "100%", height: "100%", opacity: mountedSrcRef.current ? 0.9 : 1 }}
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
            onPress={() => {
              if (muted) {
                setMuted(false);
                const el = videoRef.current;
                if (el) {
                  applyMuteDom(el, false);
                  void el.play().catch(() => {
                    applyMuteDom(el, true);
                    setMuted(true);
                  });
                }
              } else {
                setMuted(true);
                const el = videoRef.current;
                if (el) applyMuteDom(el, true);
              }
            }}
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
          /* quiet */
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
