import { Platform } from 'react-native';

import { useAppStore, type HapticsMode } from './store';

export type { HapticsMode };

type Semantic =
  | 'selection'
  | 'confirm'
  | 'saved'
  | 'support'
  | 'error';

const ACK = new Set<string>();

function mode(): HapticsMode {
  try {
    const raw = useAppStore.getState().hapticsMode;
    if (raw === 'full') return 'expressive';
    return raw ?? 'subtle';
  } catch {
    return 'subtle';
  }
}

function allowed(kind: Semantic): boolean {
  const m = mode();
  if (m === 'off') return false;
  if (m === 'subtle') return kind === 'selection' || kind === 'saved' || kind === 'support' || kind === 'error';
  return true;
}

async function native(kind: Semantic) {
  try {
    const Haptics = await import('expo-haptics');
    if (kind === 'selection') {
      await Haptics.selectionAsync();
      return;
    }
    if (kind === 'error') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (kind === 'saved' || kind === 'support') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* unsupported device */
  }
}

function webPulse(kind: Semantic) {
  if (Platform.OS !== 'web') return;
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav || typeof nav.vibrate !== 'function') return;
    const ms = kind === 'error' ? 40 : kind === 'support' ? 24 : 12;
    nav.vibrate(ms);
  } catch {
    /* ignore */
  }
}

function fire(kind: Semantic, operationId?: string) {
  if (operationId) {
    if (ACK.has(operationId)) return;
    ACK.add(operationId);
  }
  if (!allowed(kind)) return;
  if (Platform.OS === 'web') {
    webPulse(kind);
    return;
  }
  void native(kind);
}

export function hapticSelect() {
  fire('selection');
}

export function hapticTap() {
  fire('selection');
}

export function hapticSuccess() {
  fire('saved');
}

export function hapticConfirm(operationId?: string) {
  fire('confirm', operationId);
}

export function hapticSaved(operationId?: string) {
  fire('saved', operationId);
}

export function hapticSupportConfirmed(operationId?: string) {
  fire('support', operationId);
}

export function hapticError() {
  fire('error');
}

/** @deprecated decorative bursts removed — maps to a light selection. */
export function haptic(key?: string) {
  if (key === 'error') hapticError();
  else if (key === 'success') hapticSuccess();
  else hapticSelect();
}

export function hapticSignature() {
  hapticSelect();
}

export function hapticPeel() {
  hapticSelect();
}

export function hapticSourceDone() {
  hapticSaved();
}

export function hapticVerdictTick() {
  hapticSelect();
}

export function hapticVerdictLand() {
  hapticSaved();
}

export function hapticMarked() {
  hapticSelect();
}

export function hapticChapterTurn() {
  hapticSelect();
}

export function hapticPresence() {}

export function hapticOwnerVoice() {}

export function hapticExpertVoice() {}

export function hapticHeavy() {
  hapticSelect();
}

export function hapticSoft() {
  hapticSelect();
}

export function hapticFeelSignature() {
  hapticSelect();
}

export async function playHapticTour(onLabel: (label: string) => void) {
  const steps: [Semantic, string][] = [
    ['selection', 'A light selection'],
    ['saved', 'A story is saved'],
    ['support', 'Sparks land'],
    ['error', 'Something didn’t work'],
  ];
  for (const [kind, label] of steps) {
    onLabel(label);
    fire(kind);
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
}

export function clearHapticAck(operationId?: string) {
  if (operationId) ACK.delete(operationId);
  else ACK.clear();
}
