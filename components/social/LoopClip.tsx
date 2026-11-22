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
 * - Status: playSound=true plays the video's own audio (opened via tap = user gesture).
 * - Feed cards: muted autoplay by default; controls can unmute.
 * Never permanently replace video with <Image>.
 */
export function LoopClip({
  uri,
  poster,
  height,
  active = true,
  controls = false,
  /** Play the video's own audio track (status / detail). */
  playSound = false,
}: {
  uri: string;
  poster: string;
  height: number;
  active?: boolean;
  controls?: boolean;
  playSound?: boolean;
}) {
  if (Platform.OS === "web") {
    return (
      <WebLoopClip
        uri={uri}
        poster={poster}
        height={height}
        active={active}
        controls={controls || playSound}
        playSound={playSound}
      />
    );
  }
  return <NativeLoopClip uri={uri} poster={poster} height={height} active={active} playSound={playSound} />;
}

function WebLoopClip({
  uri,
  poster,
  height,
  active,
  controls,
  playSound,
}: {
  uri: string;
  poster: string;
  height: number;
  active: boolean;
  controls: boolean;
  playSound: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pageActive = usePageActive();
  const [src, setSrc] = useState("");
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(!playSound);
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
    setMuted(!playSound);
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
  }, [uri, playSound]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;

    const applyMute = (wantMuted: boolean) => {
      el.muted = wantMuted;
      el.defaultMuted = wantMuted;
      el.volume = wantMuted ? 0 : 1;
      if (wantMuted) el.setAttribute("muted", "");
      else el.removeAttribute("muted");
    };

    const play = (preferSound: boolean) => {
      el.playsInline = true;
      el.autoplay = true;
      el.loop = true;
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.setAttribute("autoplay", "");
      if (!live) {
        el.pause();
        return;
      }
      const trySound = preferSound && playSound;
      applyMute(!trySound);
      void el.play().then(
        () => {
          setReady(true);
          if (trySound) {
            applyMute(false);
            setMuted(false);
          }
        },
        () => {
          // Browser blocked unmuted autoplay — start muted, keep a way to unmute.
          applyMute(true);
          setMuted(true);
          void el.play().then(() => setReady(true)).catch(() => undefined);
        },
      );
    };

    if (el.getAttribute("data-src") !== src) {
      el.setAttribute("data-src", src);
      el.src = src;
      el.load();
    }
    const onReady = () => play(playSound);
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("playing", () => setReady(true));
    play(playSound);

    const retry = window.setInterval(() => {
      if (live && el.paused) play(false);
    }, 250);

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
      window.clearInterval(retry);
      el.pause();
    };
  }, [src, live, playSound]);

  // Keep mute state in sync when user toggles
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = muted ? 0 : 1;
    if (muted) el.setAttribute("muted", "");
    else el.removeAttribute("muted");
  }, [muted]);

  // If we had to start muted, first tap in the status unlocks original audio
  useEffect(() => {
    if (!playSound || !muted || !live || typeof document === "undefined") return;
    const unlock = () => {
      const el = videoRef.current;
      if (!el) return;
      el.muted = false;
      el.volume = 1;
      el.removeAttribute("muted");
      setMuted(false);
      void el.play().catch(() => undefined);
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("touchstart", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
    };
  }, [playSound, muted, live]);

  return (
    <View style={{ width: "100%", height, backgroundColor: "#120810", overflow: "hidden" }}>
      {src
        ? createElement("video", {
            ref: videoRef,
            src,
            muted,
            defaultMuted: !playSound,
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
        <View style={{ position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 8, zIndex: 3 }}>
          <Pressable
            accessibilityLabel={paused ? "Play video" : "Pause video"}
            onPress={() => setPaused((p) => !p)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
          >
            {paused ? <Play size={18} color="#FFF8F4" weight="fill" /> : <Pause size={18} color="#FFF8F4" weight="fill" />}
          </Pressable>
          <Pressable
            accessibilityLabel={muted ? "Unmute video" : "Mute video"}
            onPress={() => {
              const next = !muted;
              setMuted(next);
              const el = videoRef.current;
              if (el) {
                el.muted = next;
                el.volume = next ? 0 : 1;
                if (!next) void el.play().catch(() => undefined);
              }
            }}
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
  playSound,
}: {
  uri: string;
  poster: string;
  height: number;
  active: boolean;
  playSound: boolean;
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
        await v.setIsMutedAsync(!playSound);
        await v.playAsync();
      } catch {
        try {
          await v.setIsMutedAsync(true);
          await v.playAsync();
        } catch {
          /* keep trying */
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
  }, [live, uri, playSound]);

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
        key={`${uri}-${playSound ? "sound" : "mute"}`}
        source={{ uri }}
        posterSource={still ? { uri: still } : undefined}
        usePoster={Boolean(still)}
        isLooping
        shouldPlay={live}
        isMuted={!playSound}
        volume={playSound ? 1 : 0}
        resizeMode={ResizeMode.COVER}
        useNativeControls={false}
        style={{ width: "100%", height }}
      />
    </View>
  );
}
