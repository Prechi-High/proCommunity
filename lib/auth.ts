import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { track } from './analytics';
import { authCallbackPath, signInPath } from './authRedirect';
import { useAppStore } from './store';
import { supabase } from './supabase';

/**
 * Accounts live in Supabase Auth (auth.users) and public.profiles.
 * The client only holds a short-lived session token; identity and saves are on the server.
 */

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  returnTo?: string,
): Promise<{ needsEmailConfirm: boolean; needsName: boolean }> {
  if (!supabase) throw new Error('auth_unavailable');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: authCallbackPath(returnTo) },
  });
  if (error) throw new Error(error.message);
  if (data.session) {
    const name = await syncSession(data.session);
    track('auth_signed_up', {});
    return { needsEmailConfirm: false, needsName: needsName(name, data.session) };
  }
  track('auth_signup_confirm_sent', {});
  return { needsEmailConfirm: true, needsName: false };
}

export async function signInWithEmail(email: string, password: string): Promise<{ needsName: boolean }> {
  if (!supabase) throw new Error('auth_unavailable');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session) {
    throw new Error(
      error?.message?.toLowerCase().includes('invalid') ? 'Email or password is not right.' : error?.message ?? 'Could not sign in.',
    );
  }
  const name = await syncSession(data.session);
  track('auth_signed_in', { method: 'password' });
  return { needsName: needsName(name, data.session) };
}

export async function sendMagicLink(email: string, returnTo?: string): Promise<void> {
  if (!supabase) throw new Error('auth_unavailable');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authCallbackPath(returnTo),
    },
  });
  if (error) throw new Error(error.status === 429 ? 'Too many emails sent. Wait a minute and try again.' : error.message);
  track('auth_magic_link_sent', {});
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error('auth_unavailable');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: signInPath(),
  });
  if (error) throw new Error(error.message);
  track('auth_reset_sent', {});
}

export async function signInWithGoogle(returnTo?: string): Promise<void> {
  if (!supabase) throw new Error('auth_unavailable');
  const redirectTo = authCallbackPath(returnTo);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error(error?.message ?? 'Could not start Google sign-in');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Google sign-in was cancelled');
  await completeAuthFromUrl(result.url);
}

export async function completeAuthFromUrl(url: string): Promise<{ needsName: boolean }> {
  if (!supabase) throw new Error('auth_unavailable');
  const parsed = Linking.parse(url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
  if (!code) throw new Error('Sign-in link is missing a code. Try again from the app.');
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) throw new Error(error?.message ?? 'Could not complete sign-in');
  const name = await syncSession(data.session);
  track('auth_signed_in', { method: 'oauth' });
  return { needsName: needsName(name, data.session) };
}

function needsName(name: string | null, session: Session): boolean {
  return !name || name === session.user.email?.split('@')[0];
}

/** Resolves once a verified Supabase session exists. */
export async function currentSignIn(): Promise<{ needsName: boolean } | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const name = await syncSession(data.session);
  return { needsName: needsName(name, data.session) };
}

export async function setDisplayName(name: string): Promise<void> {
  const clean = name.trim().slice(0, 40);
  if (!supabase || clean.length < 2) return;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  await supabase.from('profiles').update({ display_name: clean }).eq('id', user.id);
  useAppStore.getState().updateProfile({ displayName: clean });
}

export async function signOutEverywhere(): Promise<void> {
  await supabase?.auth.signOut().catch(() => undefined);
  useAppStore.getState().signOut();
}

let inflight: { userId: string; run: Promise<string | null> } | null = null;

function syncSession(session: Session): Promise<string | null> {
  if (inflight?.userId === session.user.id) return inflight.run;
  const run = doSyncSession(session).finally(() => {
    if (inflight?.run === run) inflight = null;
  });
  inflight = { userId: session.user.id, run };
  return run;
}

async function doSyncSession(session: Session): Promise<string | null> {
  const user = session.user;
  let displayName: string | null = null;
  let isAdmin = false;
  if (supabase) {
    const { data } = await supabase.from('profiles').select('display_name,is_admin').eq('id', user.id).maybeSingle();
    displayName = (data?.display_name as string | undefined)?.trim() || null;
    isAdmin = Boolean(data?.is_admin);
  }
  const email = user.email ?? '';
  const state = useAppStore.getState();
  const localFavorites = state.profile?.id === user.id ? [] : state.favorites;
  state.setAuthProfile({
    id: user.id,
    email,
    displayName: displayName || user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Member',
    onboardingComplete: true,
    isAdmin,
  });
  void syncSaves(localFavorites.map((f) => f.productId));
  return displayName;
}

type SavedRow = { product_id: string; name: string | null; brand: string | null; category: string | null; image: string | null };

async function researchApi<T>(body: Record<string, unknown>): Promise<T> {
  const { callResearch } = await import('./research');
  return callResearch<T>(body);
}

function productRef(productId: string) {
  const p = useAppStore.getState().knownProducts[productId];
  return { productId, name: p?.name || productId, brand: p?.brand ?? '', category: p?.category ?? '', image: p?.heroImageUrl ?? null };
}

let syncing = false;

async function syncSaves(uploadIds: string[]): Promise<void> {
  syncing = true;
  try {
    if (uploadIds.length) await researchApi({ action: 'import_saves', products: uploadIds.slice(0, 200).map(productRef) });
    const { saves } = await researchApi<{ saves: SavedRow[] }>({ action: 'saves' });
    const prev = new Map(useAppStore.getState().favorites.map((f) => [f.productId, f]));
    useAppStore.getState().setFavorites(saves.map((s) => prev.get(s.product_id) ?? { productId: s.product_id, priceAlertEnabled: false }));
  } catch {
    /* retry on next sign-in */
  } finally {
    syncing = false;
  }
}

let started = false;

export function startAuth(): () => void {
  if (!supabase || started) return () => undefined;
  started = true;
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) void syncSession(data.session);
    else if (useAppStore.getState().profile) useAppStore.getState().clearProfile();
  });
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') useAppStore.getState().signOut();
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && useAppStore.getState().profile?.id !== session.user.id) {
      setTimeout(() => void syncSession(session), 0);
    }
  });

  const unsubscribe = useAppStore.subscribe((state, prev) => {
    if (syncing || state.favorites === prev.favorites || !isAuthUserId(state.profile?.id)) return;
    const before = new Set(prev.favorites.map((f) => f.productId));
    const after = new Set(state.favorites.map((f) => f.productId));
    for (const id of after) if (!before.has(id)) void researchApi({ action: 'save', product: productRef(id) }).catch(() => undefined);
    for (const id of before) if (!after.has(id)) void researchApi({ action: 'unsave', productId: id }).catch(() => undefined);
  });

  return () => {
    sub.subscription.unsubscribe();
    unsubscribe();
    started = false;
  };
}

export function isAuthUserId(id: string | undefined | null): boolean {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
}

export async function refreshAuthProfile(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) await syncSession(data.session);
}
