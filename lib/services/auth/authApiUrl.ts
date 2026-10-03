import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Client-safe URL for the OTP request endpoint (must hit Vercel/server, not Supabase). */
export function requestEmailCodeUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_AUTH_API_URL?.trim();
  const base =
    fromEnv ||
    (Constants.expoConfig?.extra as { authApiUrl?: string } | undefined)?.authApiUrl?.trim() ||
    '';

  if (base) return `${base.replace(/\/$/, '')}/api/auth/request-email-code`;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/auth/request-email-code`;
  }

  throw new Error('auth_api_unconfigured');
}
