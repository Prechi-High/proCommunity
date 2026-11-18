import { Audio as ExpoAudio, type AVPlaybackStatus } from "expo-av";
import { Platform } from "react-native";

import { MOMENT_SOUNDS } from "@/lib/moment/creatorCatalog";
import type { CreatorSettings } from "@/lib/moment/types";

/** Max BGM length when attached to a still / story post (seconds). */
export const UNMASK_IMAGE_BGM_MAX_SEC = 50;

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

export async function playStudioSound(
  creator: CreatorSettings,
  opts?: { loop?: boolean; maxMs?: number; onStatus?: (s: AVPlaybackStatus) => void },
): Promise<boolean> {
  const uri = resolveStudioSoundUri(creator);
  if (!uri) {
    await stopStudioSound();
    return false;
  }
  const key = studioSoundKey(creator)!;
  try {
    await ensureAudioMode();
    if (shared && sharedKey === key) {
      const status = await shared.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) await shared.playAsync();
      return true;
    }
    await stopStudioSound();
    const { sound } = await ExpoAudio.Sound.createAsync(
      { uri },
      {
        shouldPlay: true,
        isLooping: opts?.loop ?? true,
        volume: 1,
      },
    );
    shared = sound;
    sharedKey = key;
    sound.setOnPlaybackStatusUpdate((status) => {
      opts?.onStatus?.(status);
      if (!status.isLoaded) return;
      if (opts?.maxMs && status.positionMillis >= opts.maxMs) {
        void sound.setPositionAsync(0);
        if (!opts.loop) void sound.pauseAsync();
      }
    });
    return true;
  } catch {
    shared = null;
    sharedKey = null;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        await stopStudioSound();
        const el = document.createElement("audio");
        el.src = uri;
        el.loop = opts?.loop ?? true;
        el.crossOrigin = "anonymous";
        el.volume = 1;
        await el.play();
        htmlAudio = el;
        if (opts?.maxMs) {
          el.ontimeupdate = () => {
            if (el.currentTime * 1000 >= opts.maxMs!) {
              el.currentTime = 0;
              if (!opts.loop) el.pause();
            }
          };
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
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