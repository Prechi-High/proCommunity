import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { callIntel } from './products';

const VISITOR_KEY = 'sourced:visitor-key';
let sessionLogged = false;

async function visitorKey(): Promise<string> {
  try {
    let key = await AsyncStorage.getItem(VISITOR_KEY);
    if (!key) {
      key = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      await AsyncStorage.setItem(VISITOR_KEY, key);
    }
    return key;
  } catch {
    return `v_fallback_${Platform.OS}`;
  }
}

/** One session ping per app load (web + native). */
export async function recordSiteVisit(path = '/'): Promise<void> {
  if (sessionLogged) return;
  sessionLogged = true;
  const key = await visitorKey();
  void callIntel({ action: 'analytics', event: 'session_start', visitorKey: key, path }, 8000).catch(() => undefined);
}

export async function getVisitorKeyForApi(): Promise<string> {
  return visitorKey();
}
