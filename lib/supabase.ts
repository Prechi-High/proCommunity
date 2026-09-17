import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);

// Expo Router renders web routes in Node first, where AsyncStorage's web
// implementation reaches for window.localStorage and throws.
const isBrowser = Platform.OS !== 'web' || typeof window !== 'undefined';

const memoryStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: {
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: Platform.OS === 'web' && isBrowser,
          storage: isBrowser ? AsyncStorage : memoryStorage,
        },
      })
    : null;
