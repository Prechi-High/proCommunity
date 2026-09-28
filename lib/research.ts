import { accessToken } from './auth';
import { supabaseAnonKey, supabaseUrl } from './supabase';

/** Client for the `research` edge function: Research Cards, saves and the WhatsApp connection. */

export type CardStatus = 'created' | 'identifying' | 'researching' | 'partial' | 'complete' | 'failed' | 'archived';

export interface ResearchCard {
  id: string;
  public_reference: string;
  title: string | null;
  primary_product_id: string | null;
  status: CardStatus;
  focus: string;
  source_channel: 'app' | 'whatsapp' | 'web';
  image_url: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_shared: boolean;
}

export interface ResearchSection {
  section_key: string;
  title: string;
  content: Record<string, unknown>;
  status: 'ready' | 'partial' | 'unavailable';
  display_order: number;
}

export interface ResearchQuestion {
  id: string;
  question: string;
  status: 'pending' | 'processing' | 'answered' | 'failed';
  answer: { text?: string; takeaway?: string; enough?: boolean; basedOn?: number } | null;
  source_channel: string;
  created_at: string;
}

export interface ResearchComparison {
  id: string;
  product_b_id: string;
  comparison_snapshot: {
    a?: { name?: string; brand?: string; score?: number | null };
    b?: { name?: string; brand?: string; score?: number | null };
    verdict?: { text?: string } | null;
  } | null;
}

export interface ResearchCardView {
  card: ResearchCard;
  statusLabel: string;
  products: Array<{ product_id: string; name: string | null; brand: string | null; category: string | null; image: string | null; role: string }>;
  sections: ResearchSection[];
  questions: ResearchQuestion[];
  comparisons: ResearchComparison[];
  price: { then: Record<string, unknown> | null; now: Record<string, unknown> | null };
}

export type NotificationPreferences = {
  price_alerts: boolean;
  research_updates: boolean;
  community_replies: boolean;
  refill_reminders: boolean;
  product_drops: boolean;
};

export interface WhatsAppStatus {
  enabled: boolean;
  connected: boolean;
  phone: string | null;
  connectedAt: string | null;
  preferences: NotificationPreferences;
}

export class ResearchApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export async function callResearch<T>(body: Record<string, unknown>, timeoutMs = 30000): Promise<T> {
  const token = await accessToken();
  if (!token) throw new ResearchApiError('sign_in_required', 401);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !json) throw new ResearchApiError(json?.error ?? `http_${res.status}`, res.status);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export const research = {
  list: (q?: string) => callResearch<{ cards: ResearchCard[] }>({ action: 'list', limit: 30, ...(q ? { q } : {}) }).then((r) => r.cards),
  get: (cardId: string) => callResearch<ResearchCardView>({ action: 'get', cardId }),
  create: (product: { productId: string; name: string; brand?: string; category?: string; image?: string | null }) =>
    callResearch<{ card: ResearchCard; existing: boolean }>({ action: 'create', product: { ...product, brand: product.brand ?? '', category: product.category ?? '' } }),
  ask: (cardId: string, question: string) => callResearch<{ question: ResearchQuestion }>({ action: 'ask', cardId, question }, 60000),
  compare: (cardId: string, target: string) => callResearch<{ comparison: ResearchComparison }>({ action: 'compare', cardId, target }, 90000),
  share: (cardId: string) => callResearch<{ url: string }>({ action: 'share', cardId }),
  revokeShares: (cardId: string) => callResearch<{ revoked: number }>({ action: 'revoke_shares', cardId }),
  refresh: (cardId: string) => callResearch<{ queued: boolean }>({ action: 'refresh', cardId }),
  archive: (cardId: string) => callResearch<{ ok: boolean }>({ action: 'archive', cardId }),
};

export const whatsapp = {
  status: () => callResearch<WhatsAppStatus>({ action: 'whatsapp_status' }),
  link: () => callResearch<{ code: string; waLink: string | null; expiresAt: string; ttlMinutes: number }>({ action: 'whatsapp_link' }),
  disconnect: () => callResearch<{ disconnected: boolean }>({ action: 'whatsapp_disconnect' }),
  setPreferences: (preferences: Partial<NotificationPreferences>) =>
    callResearch<{ preferences: NotificationPreferences }>({ action: 'whatsapp_preferences', preferences }),
};

export const STATUS_TONE: Record<CardStatus, 'neutral' | 'good' | 'warn' | 'bad' | 'accent'> = {
  created: 'accent',
  identifying: 'accent',
  researching: 'accent',
  partial: 'warn',
  complete: 'good',
  failed: 'bad',
  archived: 'neutral',
};

export const isInFlight = (s: CardStatus) => s === 'created' || s === 'identifying' || s === 'researching';
