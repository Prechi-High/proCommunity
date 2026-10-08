import { Platform } from 'react-native';

const memory = new Set<string>();
const KEY_PREFIX = 'unmask:revealed:';

export function hasUnmaskRevealed(productId: string): boolean {
  if (memory.has(productId)) return true;
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem(KEY_PREFIX + productId) === '1';
  }
  return false;
}

export function markUnmaskRevealed(productId: string): void {
  memory.add(productId);
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(KEY_PREFIX + productId, '1');
    } catch {
      // ignore quota
    }
  }
}

export function clearUnmaskRevealed(productId: string): void {
  memory.delete(productId);
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(KEY_PREFIX + productId);
    } catch {
      // ignore
    }
  }
}
