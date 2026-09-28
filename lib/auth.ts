import type { Session } from '@supabase/supabase-js';

import { track } from './analytics';
import { useAppStore } from './store';
import { supabase } from './supabase';

/**
 * Real Sourced accounts: Supabase Auth with an emailed one-time code.
 * The store's profile mirrors the verified session (id = auth user id), so every
 * server call can prove who the user is with the access token.
 */

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function sendCode(email: string): Promise<void> {
  if (!supabase) throw new Error('auth_unavailable');
  // Until custom SMTP is configured the default email carries a link instead of {{ .Token }}; on web it lands back here.
  const emailRedirectTo = typeof window !== 'undefined' && window.location?.origin ? `${window.location.origin}/sign-in` : undefined;
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo } });
  if (error) throw new Error(error.status === 429 ? 'Too many codes requested. Wait a minute and try again.' : error.message);
  track('auth_code_sent', {});
}

export async function verifyCode(email: string, code: string): Promise<{ needsName: boolean }> {
  if (!supabase) throw new Error('auth_unavailable');
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error || !data.session) throw new Error(error?.message?.includes('expired') ? 'That code has expired. Request a new one.' : 'That code is not right. Check it and try again.');
  const name = await syncSession(data.session);
  track('auth_signed_in', {});
  return { needsName: needsName(name, data.session) };
}

function needsName(name: string | null, session: Session): boolean {
  return !name || name === session.user.email?.split('@')[0];
}

/** Resolves once a session exists (code or emailed link); null when signed out. */
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
  if (supabase) {
    const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    displayName = (data?.display_name as string | undefined)?.trim() || null;
  }
  const email = user.email ?? '';
  const state = useAppStore.getState();
  const localFavorites = state.profile?.id === user.id ? [] : state.favorites;
  state.setAuthProfile({
    id: user.id,
    email,
    displayName: displayName || email.split('@')[0] || 'Member',
    onboardingComplete: true,
  });
  void syncSaves(localFavorites.map((f) => f.productId));
  return displayName;
}

// ---------------------------------------------------------------------------
// Saved products live in the account (saved_products) so the app and WhatsApp share them.

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

/** Uploads device saves once, then adopts the account's saved list as the source of truth. */
async function syncSaves(uploadIds: string[]): Promise<void> {
  syncing = true;
  try {
    if (uploadIds.length) await researchApi({ action: 'import_saves', products: uploadIds.slice(0, 200).map(productRef) });
    const { saves } = await researchApi<{ saves: SavedRow[] }>({ action: 'saves' });
    const prev = new Map(useAppStore.getState().favorites.map((f) => [f.productId, f]));
    useAppStore.getState().setFavorites(saves.map((s) => prev.get(s.product_id) ?? { productId: s.product_id, priceAlertEnabled: false }));
  } catch {
    // Keep the device list; the next sign-in retries.
  } finally {
    syncing = false;
  }
}

let started = false;

/** Call once at app start: restores the session and keeps saves mirrored to the account. */
export function startAuth(): () => void {
  if (!supabase || started) return () => undefined;
  started = true;
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) void syncSession(data.session);
    // Legacy device-only profiles must sign in for real; their device saves are kept and uploaded on sign-in.
    else if (useAppStore.getState().profile) useAppStore.getState().clearProfile();
  });
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') useAppStore.getState().signOut();
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && useAppStore.getState().profile?.id !== session.user.id) setTimeout(() => void syncSession(session), 0);
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
