import { z } from 'zod';

import { track } from '@/lib/analytics';
import { requestEmailCodeUrl } from './authApiUrl';

const emailSchema = z.string().trim().email().max(320);

export async function requestEmailCode(email: string): Promise<void> {
  const normalized = emailSchema.parse(email.trim().toLowerCase());
  let url: string;
  try {
    url = requestEmailCodeUrl();
  } catch {
    throw new Error('Sign-in service is not configured. Set EXPO_PUBLIC_AUTH_API_URL for native builds.');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized }),
    });
  } catch {
    throw new Error("We couldn't connect. Check your internet connection and try again.");
  }

  const result = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };

  if (!response.ok) {
    if (response.status === 429) {
      track('auth_email_code_requested', { outcome: 'rate_limited' });
      throw new Error(result.error ?? 'Please wait before requesting another code.');
    }
    if (response.status === 400) {
      throw new Error(result.error ?? 'Please enter a valid email address.');
    }
    track('auth_email_code_delivery_failed', {});
    throw new Error(result.error ?? "We couldn't send your code right now. Please try again.");
  }

  track('auth_email_code_requested', { outcome: 'sent' });
}
