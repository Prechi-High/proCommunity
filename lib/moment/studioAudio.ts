import { Audio as ExpoAudio, type AVPlaybackStatus } from "expo-av";
import { Platform } from "react-native";

import { MOMENT_SOUNDS } from "@/lib/moment/creatorCatalog";
import type { CreatorSettings } from "@/lib/moment/types";

/** Max BGM length when attached to a still / slide post (seconds). */
export const UNMASK_IMAGE_BGM_MAX_SEC = 30;

let shared: ExpoAudio.Sound | null = null;
let sharedKey: string | null = null;
let htmlAudio: HTMLAudioElement | null = null;

export function resolveStudioSoundUri(creator: CreatorSettings): string | null {
  if (creator.localSoundUri) return creator.localSoundUri;
  if (!creator.soundId) return null;
  return MOMENT_SOUNDS.find((s) => s.id === creator.soundId)?.previewUri ?? null;
}

export function studioSoundKey(creator: CreatorSettings): string | null {
  const uri = resolveStudioSoundUri(creator);
  if (!uri) return null;
  return `${uri}::${creator.soundId || creator.localSoundName || "local"}`;
}

async function ensureAudioMode() {
  await ExpoAudio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

export async function stopStudioSound() {
  try {
    await shared?.stopAsync();
    await shared?.unloadAsync();
  } catch {
    /* ignore */
  }
  shared = null;
  sharedKey = null;
  if (htmlAudio) {
    htmlAudio.pause();
    htmlAudio.src = "";
    htmlAudio = null;
  }
}

export async function isStudioSoundPlaying(): Promise<boolean> {
  try {
    const status = await shared?.getStatusAsync();
    if (status?.isLoaded && status.isPlaying) return true;
  } catch {
    /* ignore */
  }
  if (htmlAudio && !htmlAudio.paused && !htmlAudio.ended) return true;
  return false;
}

/**
 * Play studio sound.
 * - Preview (loop:false): plays once then stops. Calling again while playing stops it.
 * - Published/edit canvas (loop:true): loops until maxMs or stopStudioSound.
 */
export async function playStudioSound(
  creator: CreatorSettings,
  opts?: { loop?: boolean; maxMs?: number; onStatus?: (s: AVPlaybackStatus) => void; toggleStop?: boolean },
): Promise<"playing" | "stopped" | "failed"> {
  const uri = resolveStudioSoundUri(creator);
  if (!uri) {
    await stopStudioSound();
    return "failed";
  }
  const key = studioSoundKey(creator)!;
  const loop = opts?.loop ?? false;
  const toggleStop = opts?.toggleStop ?? !loop;

  // Tap-again while same track is playing → stop (picker preview)
  if (toggleStop && sharedKey === key) {
    const playing = await isStudioSoundPlaying();
    if (playing) {
      await stopStudioSound();
      return "stopped";
    }
  }

  try {
    await ensureAudioMode();
    await stopStudioSound();
    const { sound } = await ExpoAudio.Sound.createAsync(
      { uri },
      {
        shouldPlay: true,
        isLooping: loop,
        volume: 1,
      },
    );
    shared = sound;
    sharedKey = key;
    sound.setOnPlaybackStatusUpdate((status) => {
      opts?.onStatus?.(status);
      if (!status.isLoaded) return;
      if (opts?.maxMs && status.positionMillis >= opts.maxMs) {
        if (loop) {
          void sound.setPositionAsync(0);
        } else {
          void stopStudioSound();
        }
      }
      if (!loop && status.didJustFinish) {
        void stopStudioSound();
      }
    });
    return "playing";
  } catch {
    shared = null;
    sharedKey = null;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        await stopStudioSound();
        const el = document.createElement("audio");
        el.src = uri;
        el.loop = loop;
        el.crossOrigin = "anonymous";
        el.volume = 1;
        await el.play();
        htmlAudio = el;
        el.onended = () => {
          if (!loop) {
            htmlAudio = null;
          }
        };
        if (opts?.maxMs) {
          el.ontimeupdate = () => {
            if (el.currentTime * 1000 >= opts.maxMs!) {
              if (loop) el.currentTime = 0;
              else {
                el.pause();
                htmlAudio = null;
              }
            }
          };
        }
        return "playing";
      } catch {
        return "failed";
      }
    }
    return "failed";
  }
}

export async function pauseStudioSound() {
  try {
    await shared?.pauseAsync();
  } catch {
    /* ignore */
  }
  htmlAudio?.pause();
}
