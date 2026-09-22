import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra as { supabaseUrl?: string; supabaseAnonKey?: string } | undefined;
// Public anon credentials. Required because Expo web inlines env at export time;
// an empty Vercel EXPO_PUBLIC_* var leaves extra.supabaseUrl as "" and the
// product page never calls discover-video-content or reads video_cache.
const PUBLIC_SUPABASE_URL = 'https://aqdptcuwpneuyzjavjak.supabase.co';
const PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZHB0Y3V3cG5ldXl6amF2amFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjQzNjYsImV4cCI6MjEwNTA0MDM2Nn0.jbIzvkqQ7qnYhH45uvIwDI97-tjdHsPY4S-0yv9XBXg';

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  extra?.supabaseUrl?.trim() ||
  PUBLIC_SUPABASE_URL;
const anon =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.JWT?.trim() ||
  extra?.supabaseAnonKey?.trim() ||
  PUBLIC_SUPABASE_ANON_KEY;

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
