import { Platform } from 'react-native';

import { useAppStore, type HapticsMode } from './store';

export type { HapticsMode };

/** Vibration patterns from sourced-v1 (2).html HP map. Even indices = buzz ms. */
const HP: Record<string, number[]> = {
  tap: [12],
  select: [16],
  soft: [8],
  tick: [5],
  heavy: [40],
  open: [14, 50, 24],
  close: [10],
  peel: [6, 24, 10, 24, 20],
  source: [16, 60, 28],
  verdict: [20, 45, 26, 45, 36, 60, 64],
  mark: [8, 22, 12, 22, 18, 22, 28],
  chapter: [14, 44, 30],
  presence: [10, 70, 18],
  owner: [20, 70, 20],
  expert: [20, 60, 20, 60, 36],
  success: [14, 60, 14, 60, 30],
  error: [40, 40, 40],
  sign: [30, 90, 30, 90, 70],
};

let lastHap = 0;
let signed = false;

function mode(): HapticsMode {
  try {
    return useAppStore.getState().hapticsMode ?? 'full';
  } catch {
    return 'full';
  }
}

function scale(): number {
  const m = mode();
  if (m === 'off') return 0;
  if (m === 'subtle') return 0.6;
  return 1.1;
}

function webVibrate(pattern: number[]) {
  if (Platform.OS !== 'web') return;
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && typeof nav.vibrate === 'function') nav.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

async function nativeBurst(pattern: number[]) {
  try {
    const Haptics = await import('expo-haptics');
    let t = 0;
    pattern.forEach((d, i) => {
      if (i % 2 === 1) {
        t += d;
        return;
      }
      const style =
        d >= 36
          ? Haptics.ImpactFeedbackStyle.Heavy
          : d >= 16
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
      setTimeout(() => {
        void Haptics.impactAsync(style);
      }, t);
      t += Math.max(4, d);
    });
  } catch {
    /* ignore */
  }
}

/** Core haptic keyed like the HTML prototype. */
export function haptic(key: keyof typeof HP | string) {
  const f = scale();
  if (!f) return;
  lastHap = Date.now();
  const raw = HP[key] ?? HP.tap;
  const pattern = raw.map((d, i) => (i % 2 === 0 ? Math.max(4, Math.round(d * f)) : d));
  if (Platform.OS === 'web') {
    webVibrate(pattern);
    return;
  }
  void nativeBurst(pattern);
}

/** First pointer / press of the session. */
export function hapticSignature() {
  if (signed) {
    haptic('tap');
    return;
  }
  signed = true;
  haptic('sign');
}

export function hapticPeel() {
  haptic('peel');
}

export function hapticSourceDone() {
  haptic('source');
}

export function hapticVerdictTick() {
  if (mode() === 'subtle') return;
  haptic('tick');
}

export function hapticVerdictLand() {
  haptic('verdict');
}

export function hapticMarked() {
  haptic('mark');
}

export function hapticChapterTurn() {
  haptic('chapter');
}

export function hapticPresence() {
  haptic('presence');
}

export function hapticOwnerVoice() {
  haptic('owner');
}

export function hapticExpertVoice() {
  haptic('expert');
}

/** Generic control tap — debounce so nested presses don’t double-fire. */
export function hapticTap() {
  if (Date.now() - lastHap < 90) return;
  haptic('tap');
}

export function hapticSelect() {
  haptic('select');
}

export function hapticHeavy() {
  haptic('heavy');
}

export function hapticSoft() {
  haptic('soft');
}

export function hapticSuccess() {
  haptic('success');
}

/** Demo sequence for You → Feel our signature. */
export function hapticFeelSignature() {
  haptic('sign');
  setTimeout(() => haptic('peel'), 220);
  setTimeout(() => haptic('mark'), 520);
  setTimeout(() => haptic('verdict'), 860);
}

const FEEL_TOUR: [keyof typeof HP, string][] = [
  ['sign', 'Sourced signature'],
  ['peel', 'A redaction lifts'],
  ['source', 'A source is read'],
  ['verdict', 'The verdict lands'],
  ['mark', 'A highlight is marked'],
  ['presence', 'Someone’s here'],
  ['owner', 'A verified owner replies'],
  ['expert', 'An expert replies'],
];

export async function playHapticTour(onLabel: (label: string) => void) {
  for (const [key, label] of FEEL_TOUR) {
    onLabel(label);
    haptic(key);
    await new Promise((resolve) => setTimeout(resolve, 1300));
  }
}
