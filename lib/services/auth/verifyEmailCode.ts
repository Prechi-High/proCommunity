import { completeEmailOtpVerification } from '@/lib/auth';

export type AuthResult = { needsName: boolean };

export async function verifyEmailCode(email: string, code: string): Promise<AuthResult> {
  return completeEmailOtpVerification(email, code);
}
