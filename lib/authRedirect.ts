import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

/** OAuth / email links must land on this route (add to Supabase Auth → URL configuration). */
export function authCallbackPath(returnTo?: string | null): string {
  const base = makeRedirectUri({
    scheme: 'sourced',
    path: 'callback',
    preferLocalhost: true,
  });
  if (returnTo?.startsWith('/')) {
    const join = base.includes('?') ? '&' : '?';
    return `${base}${join}returnTo=${encodeURIComponent(returnTo)}`;
  }
  return base;
}

export function signInPath(returnTo?: string | null): string {
  if (typeof window === 'undefined' || !window.location?.origin) return '/sign-in';
  const base = `${window.location.origin}/sign-in`;
  if (returnTo?.startsWith('/')) return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
  return base;
}
