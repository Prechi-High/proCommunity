/**
 * SERVER ONLY — shared logic for POST /api/auth/request-email-code
 */
import { z } from 'zod';

import { AUTH_REQUEST_MAX_BODY_BYTES } from './constants';
import { generateEmailOtp } from './generateEmailOtp';
import { checkOtpRequestRateLimit } from './rateLimit';
import { getAuthEmailProvider } from '../email/authEmailProvider';

const emailSchema = z.object({
  email: z.string().trim().email().max(320),
});

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const fwd = headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) return raw.split(',')[0]?.trim() || 'unknown';
  const real = headers['x-real-ip'];
  return (Array.isArray(real) ? real[0] : real)?.trim() || 'unknown';
}

export type HandlerResult =
  | { status: 200; body: { success: true } }
  | { status: 400; body: { error: string } }
  | { status: 429; body: { error: string } }
  | { status: 503; body: { error: string } };

export async function handleRequestEmailCode(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): Promise<HandlerResult> {
  if (rawBody.length > AUTH_REQUEST_MAX_BODY_BYTES) {
    return { status: 400, body: { error: 'Please enter a valid email address.' } };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'Please enter a valid email address.' } };
  }

  const parsed = emailSchema.safeParse(json);
  if (!parsed.success) {
    return { status: 400, body: { error: 'Please enter a valid email address.' } };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(headers);

  const limit = await checkOtpRequestRateLimit(email, ip);
  if (!limit.allowed) {
    return { status: 429, body: { error: 'Please wait before requesting another code.' } };
  }

  try {
    const { otp } = await generateEmailOtp(email);
    try {
      await getAuthEmailProvider().sendVerificationCode({ to: email, code: otp });
    } catch (sendErr) {
      console.error('[auth] email_delivery_failed', sendErr instanceof Error ? sendErr.message : 'unknown');
      return { status: 503, body: { error: "We couldn't send your code right now. Please try again." } };
    }
    return { status: 200, body: { success: true } };
  } catch {
    return { status: 503, body: { error: "We couldn't send your code right now. Please try again." } };
  }
}
