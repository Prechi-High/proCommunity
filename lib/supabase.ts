import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: Platform.OS === 'web',
          storage: AsyncStorage,
        },
      })
    : null;
