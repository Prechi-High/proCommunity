import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = 'unmask:brand-intro-seen';
const COLD_KEY = 'unmask:brand-intro-cold-done';

/** Web: once per browser session. Native: once per cold start (until app process ends). */
export async function shouldPlayBrandIntro(pathname: string): Promise<boolean> {
  if (/product|results|research|compare|thread|admin|member|settings/i.test(pathname)) return false;
  const home = pathname === '/' || pathname === '' || pathname === '/index' || /^\/?(\(tabs\))?\/?$/.test(pathname);
  if (!home) return false;

  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem(KEY) !== '1';
  }
  try {
    const cold = await AsyncStorage.getItem(COLD_KEY);
    return cold !== '1';
  } catch {
    return true;
  }
}

export async function markBrandIntroSeen(): Promise<void> {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(KEY, '1');
    return;
  }
  try {
    await AsyncStorage.setItem(COLD_KEY, '1');
  } catch {
    /* ignore */
  }
}
