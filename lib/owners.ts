import { useQuery, useQueryClient } from '@tanstack/react-query';

import { accessToken, isAuthUserId } from './auth';
import { callIntel } from './products';
import { prepareImage, type VisionAsset } from './productVision';
import { useAppStore } from './store';
import { supabaseAnonKey, supabaseUrl } from './supabase';
import type { OwnershipMilestone, OwnershipNote, Product } from './types';

/** A product a member proved they own with a live in-app photo. Ownership is per product, never global. */
export interface OwnedProduct {
  productId: string;
  productName: string;
  brand: string | null;
  category: string | null;
  productImage: string | null;
  verifiedAt: string | null;
}

export interface MemberReply {
  id: string;
  body: string;
  helpful: number;
  created_at: string;
  is_owner: boolean;
  owner_product_id: string | null;
  owner_product_name: string | null;
  owner_product_image: string | null;
  thread_id: string;
  community_threads: { id: string; title: string; product_id: string; product_name: string; product_image: string | null; compare_name: string | null } | null;
}

export interface MemberThread {
  id: string;
  title: string;
  kind: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  compare_name: string | null;
  reply_count: number;
  votes: number;
  created_at: string;
  is_owner: boolean;
  owner_product_id: string | null;
  owner_product_name: string | null;
}

export interface MemberProfile {
  id: string;
  name: string;
  joinedAt: string | null;
  owned: OwnedProduct[];
  notes: OwnershipNote[];
  replies: MemberReply[];
  threads: MemberThread[];
  stats: { answers: number; posts: number; helpful: number; verified: number; notes: number };
}

export type VerifyOutcome =
  | { status: 'verified'; verification: OwnedProduct }
  | { status: 'rejected'; reason: string; tip: string; attemptsLeft: number };

export async function fetchMember(id: string): Promise<MemberProfile> {
  const res = await callIntel<{ member: MemberProfile }>({ action: 'member', profileId: id }, 20000);
  return res.member;
}

export type OwnershipNoteInput = {
  product: Pick<Product, 'id' | 'name' | 'brand' | 'category' | 'heroImageUrl'>;
  milestone: OwnershipMilestone;
  title: string;
  body: string;
  usedFor?: string;
  usedDuration?: string;
  timesBought?: number | null;
  rating?: number | null;
  wouldRebuy?: boolean | null;
  timeToProblem?: string;
  timeToResults?: string;
  positiveTags?: string[];
  issueTags?: string[];
  contextTags?: string[];
};

/** A verified owner contributes an Ownership Note: richer than a review, useful to future answers. */
export async function createOwnershipNote(input: OwnershipNoteInput): Promise<OwnershipNote> {
  const res = await callIntel<{ note?: OwnershipNote }>(
    {
      action: 'ownership_note',
      productId: input.product.id,
      productName: input.product.name,
      productImage: input.product.heroImageUrl ?? null,
      brand: input.product.brand,
      category: input.product.category,
      milestone: input.milestone,
      title: input.title,
      body: input.body,
      usedFor: input.usedFor,
      usedDuration: input.usedDuration,
      timesBought: input.timesBought,
      rating: input.rating,
      wouldRebuy: input.wouldRebuy,
      timeToProblem: input.timeToProblem,
      timeToResults: input.timeToResults,
      positiveTags: input.positiveTags ?? [],
      issueTags: input.issueTags ?? [],
      contextTags: input.contextTags ?? [],
    },
    20000,
  );
  if (!res.note) throw new Error('note_failed');
  return res.note;
}

const VERIFY_ERRORS: Record<string, string> = {
  sign_in_required: 'Sign in to verify that you own this.',
  too_many_attempts: 'Too many tries for now. Try again later.',
  live_photo_required: 'Take the photo with the in-app camera.',
  check_unavailable: 'We couldn’t check the photo right now. Try again in a moment.',
  invalid_image: 'That photo couldn’t be read. Take it again.',
};

/** Sends a live camera photo to be checked against the product. Only camera captures are allowed. */
export async function verifyOwnership(asset: VisionAsset, product: Product): Promise<VerifyOutcome> {
  const image = await prepareImage(asset);
  if (!image) throw new Error('That photo couldn’t be read. Take it again.');
  const token = await accessToken();
  if (!token) throw new Error(VERIFY_ERRORS.sign_in_required);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/product-vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
      body: JSON.stringify({
        action: 'verify_owner',
        source: 'camera',
        imageBase64: image.base64,
        mimeType: image.mime,
        product: { id: product.id, name: product.name, brand: product.brand, category: product.category, image: product.heroImageUrl ?? null },
      }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as
      | { error?: string; hint?: string; status?: string; reason?: string; tip?: string; attemptsLeft?: number; verification?: OwnedProduct }
      | null;
    if (!res.ok || !body || body.error) throw new Error(body?.hint || VERIFY_ERRORS[body?.error ?? ''] || 'Verification didn’t finish. Try again.');
    if (body.status === 'verified' && body.verification) return { status: 'verified', verification: body.verification };
    return { status: 'rejected', reason: body.reason ?? '', tip: body.tip ?? '', attemptsLeft: body.attemptsLeft ?? 0 };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('The check took too long. Try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** The signed-in member's own profile, including verified products. */
export function useMyMember() {
  const id = useAppStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['member', id],
    queryFn: () => fetchMember(id!),
    enabled: isAuthUserId(id),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Ownership matches the same product even when the slug differs slightly (brand prefix etc.). */
export function sameProductId(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 8) return false;
  const s = short.toLowerCase().split('-');
  const l = long.toLowerCase().split('-');
  return s.every((t) => l.includes(t)) && l.length - s.length <= 1;
}

export function useOwnsProduct(productId: string | null | undefined): OwnedProduct | null {
  const me = useMyMember();
  if (!productId) return null;
  return me.data?.owned.find((o) => sameProductId(o.productId, productId)) ?? null;
}

export function useRefreshOwnership() {
  const qc = useQueryClient();
  const id = useAppStore((s) => s.profile?.id);
  return () => {
    void qc.invalidateQueries({ queryKey: ['member', id] });
    void qc.invalidateQueries({ queryKey: ['thread'] });
    void qc.invalidateQueries({ queryKey: ['room'] });
  };
}
