/**
 * Peel / tear sound when a redaction bar lifts and reveals marked text.
 * Web: procedural noise. Native: assets/sounds/peel.wav via expo-av.
 */

import { Platform } from 'react-native';

import { useAppStore } from './store';

let unlocked = false;
let nativeSound: {
  replayAsync: () => Promise<unknown>;
  setPositionAsync: (n: number) => Promise<unknown>;
} | null = null;
let loadingNative = false;

function soundsAllowed() {
  try {
    return useAppStore.getState().hapticsMode !== 'off';
  } catch {
    return true;
  }
}

/** Call once from a user gesture so browsers allow audio. */
export function unlockAudio() {
  unlocked = true;
  if (Platform.OS === 'web') {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      void ctx.resume();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      void ctx.close();
    } catch {
      /* ignore */
    }
  } else {
    void ensureNative();
  }
}

function playWebPeel() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const duration = 0.38;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 7.5) * (1 - t / duration);
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;
      const crackle = (Math.random() > 0.92 ? (Math.random() * 2 - 1) * 0.55 : 0) * Math.exp(-t * 14);
      const pitch = Math.sin(2 * Math.PI * (420 - t * 680) * t) * 0.08 * env;
      data[i] = (last * 0.55 + crackle + pitch) * env * 0.85;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
    src.onended = () => {
      void ctx.close();
    };
  } catch {
    /* ignore */
  }
}

async function ensureNative() {
  if (nativeSound || loadingNative || Platform.OS === 'web') return;
  loadingNative = true;
  try {
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../assets/sounds/peel.wav'),
      { volume: 0.75, shouldPlay: false },
    );
    nativeSound = sound;
  } catch {
    nativeSound = null;
  } finally {
    loadingNative = false;
  }
}

/** Play peel/tear when redaction lifts. Safe to call often. */
export function playPeelSound() {
  if (!soundsAllowed()) return;
  unlocked = true;
  if (Platform.OS === 'web') {
    playWebPeel();
    return;
  }
  void (async () => {
    await ensureNative();
    if (!nativeSound) return;
    try {
      await nativeSound.setPositionAsync(0);
      await nativeSound.replayAsync();
    } catch {
      /* ignore */
    }
  })();
}

void unlocked;
