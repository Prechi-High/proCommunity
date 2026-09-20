import { Platform } from 'react-native';

import { useAppStore, type HapticsMode } from './store';

export type { HapticsMode };

type Impact = 'light' | 'medium' | 'heavy';
type Notification = 'success' | 'warning' | 'error';

function mode(): HapticsMode {
  try {
    return useAppStore.getState().hapticsMode ?? 'full';
  } catch {
    return 'full';
  }
}

function webVibrate(pattern: number | number[]) {
  if (Platform.OS !== 'web' || mode() === 'off') return;
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && typeof nav.vibrate === 'function') nav.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

async function impact(style: Impact) {
  const m = mode();
  if (m === 'off') return;
  if (m === 'subtle' && style === 'heavy') {
    style = 'medium';
  }
  if (Platform.OS === 'web') {
    webVibrate(style === 'light' ? 8 : style === 'medium' ? 14 : 24);
    return;
  }
  try {
    const Haptics = await import('expo-haptics');
    const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    await Haptics.impactAsync(map[style]);
  } catch {
    /* ignore */
  }
}

async function notify(type: Notification) {
  const m = mode();
  if (m === 'off') return;
  if (Platform.OS === 'web') {
    webVibrate(type === 'success' ? [10, 40, 16] : 12);
    return;
  }
  try {
    const Haptics = await import('expo-haptics');
    const map = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    };
    await Haptics.notificationAsync(map[type]);
  } catch {
    /* ignore */
  }
}

async function selection() {
  if (mode() === 'off') return;
  if (Platform.OS === 'web') {
    webVibrate(6);
    return;
  }
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.selectionAsync();
  } catch {
    /* ignore */
  }
}

/** First meaningful touch / brand beat. */
export function hapticSignature() {
  void impact(mode() === 'subtle' ? 'light' : 'medium');
}

/** Redaction bar peeling. */
export function hapticPeel() {
  void impact('light');
}

/** A source row finishes reading. */
export function hapticSourceDone() {
  void notify('success');
}

/** Score digit ticking up. */
export function hapticVerdictTick() {
  if (mode() === 'subtle') return;
  void selection();
}

/** Score lands. */
export function hapticVerdictLand() {
  void impact(mode() === 'subtle' ? 'medium' : 'heavy');
}

/** Highlighter mark fills. */
export function hapticMarked() {
  void impact('light');
}

/** Case chapter pager turns. */
export function hapticChapterTurn() {
  void impact('medium');
}

/** Soft presence pulse. */
export function hapticPresence() {
  if (mode() === 'subtle') return;
  void selection();
}

/** Verified owner reply. */
export function hapticOwnerVoice() {
  void impact('medium').then(() => {
    setTimeout(() => void impact('light'), 80);
  });
}

/** Expert reply. */
export function hapticExpertVoice() {
  void impact('medium').then(() => {
    setTimeout(() => void impact('light'), 70);
    setTimeout(() => void impact('light'), 140);
  });
}

/** Generic control tap. */
export function hapticTap() {
  void selection();
}
