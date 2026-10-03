import { createHash } from 'crypto';

function pepper(): string {
  return (
    process.env.AUTH_RATE_LIMIT_PEPPER?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 24) ||
    'sourced-auth-rate-limit'
  );
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(`email:${pepper()}:${email}`).digest('hex');
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(`ip:${pepper()}:${ip}`).digest('hex');
}
