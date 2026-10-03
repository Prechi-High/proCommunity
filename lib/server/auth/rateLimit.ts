/**
 * SERVER ONLY — OTP request rate limits (Redis preferred, Supabase table fallback).
 */
import { getRedisClient } from '../redis/client';
import {
  OTP_MAX_EMAIL_REQUESTS_PER_HOUR,
  OTP_MAX_IP_REQUESTS_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
} from './constants';
import { hashEmail, hashIp } from './hash';
import { getSupabaseAdmin } from './supabaseAdmin';

export type RateLimitResult = { allowed: true } | { allowed: false; reason: 'cooldown' | 'email' | 'ip' };

const HOUR_SEC = 3600;

async function redisCooldown(emailHash: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  const key = `auth:otp:cooldown:${emailHash}`;
  const set = await redis.set(key, '1', { nx: true, ex: OTP_RESEND_COOLDOWN_SECONDS });
  return set === 'OK';
}

async function redisCount(key: string, windowSec: number, max: number): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return true;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec + 5);
  return n <= max;
}

async function supabaseRecordAndCount(emailHash: string, ipHash: string): Promise<RateLimitResult> {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - HOUR_SEC * 1000).toISOString();
  const sinceCooldown = new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString();

  const { count: emailRecent } = await admin
    .from('auth_email_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', emailHash)
    .gte('created_at', sinceCooldown);
  if ((emailRecent ?? 0) > 0) return { allowed: false, reason: 'cooldown' };

  const { count: emailHour } = await admin
    .from('auth_email_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', emailHash)
    .gte('created_at', since);
  if ((emailHour ?? 0) >= OTP_MAX_EMAIL_REQUESTS_PER_HOUR) return { allowed: false, reason: 'email' };

  const { count: ipHour } = await admin
    .from('auth_email_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if ((ipHour ?? 0) >= OTP_MAX_IP_REQUESTS_PER_HOUR) return { allowed: false, reason: 'ip' };

  await admin.from('auth_email_rate_limits').insert({ email_hash: emailHash, ip_hash: ipHash });
  await admin.from('auth_email_rate_limits').delete().lt('created_at', new Date(Date.now() - 2 * HOUR_SEC * 1000).toISOString());

  return { allowed: true };
}

export async function checkOtpRequestRateLimit(email: string, ip: string): Promise<RateLimitResult> {
  const emailHash = hashEmail(email);
  const ipHash = hashIp(ip || 'unknown');

  const redis = getRedisClient();
  if (redis) {
    const cooldownOk = await redisCooldown(emailHash);
    if (!cooldownOk) return { allowed: false, reason: 'cooldown' };

    const emailOk = await redisCount(`auth:otp:email:${emailHash}`, HOUR_SEC, OTP_MAX_EMAIL_REQUESTS_PER_HOUR);
    if (!emailOk) return { allowed: false, reason: 'email' };

    const ipOk = await redisCount(`auth:otp:ip:${ipHash}`, HOUR_SEC, OTP_MAX_IP_REQUESTS_PER_HOUR);
    if (!ipOk) return { allowed: false, reason: 'ip' };

    return { allowed: true };
  }

  return supabaseRecordAndCount(emailHash, ipHash);
}
