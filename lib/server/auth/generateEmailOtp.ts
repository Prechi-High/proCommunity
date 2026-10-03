/**
 * SERVER ONLY — asks Supabase Auth Admin for the email OTP. Never return OTP to HTTP clients.
 */
import { getSupabaseAdmin } from './supabaseAdmin';

export type GenerateOtpResult = { otp: string };

export async function generateEmailOtp(email: string): Promise<GenerateOtpResult> {
  const supabase = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();

  const attempt = async (type: 'magiclink' | 'invite') => {
    return supabase.auth.admin.generateLink({
      type,
      email: normalized,
    });
  };

  let { data, error } = await attempt('magiclink');
  if (error) {
    const retry = await attempt('invite');
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('[auth] generate_link_failed', error.message);
    throw new Error('otp_generation_failed');
  }

  const props = data?.properties as { email_otp?: string } | undefined;
  const otp = props?.email_otp?.trim();
  if (!otp || !/^\d{6}$/.test(otp)) {
    console.error('[auth] generate_link_missing_otp');
    throw new Error('otp_generation_failed');
  }

  return { otp };
}
