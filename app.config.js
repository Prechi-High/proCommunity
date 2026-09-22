const app = require('./app.json');

function env(name, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

// Client-safe fallbacks so `expo export` still bakes a working web client when
// Vercel is missing EXPO_PUBLIC_* vars. Never put the service role here.
const PUBLIC_SUPABASE_URL = 'https://aqdptcuwpneuyzjavjak.supabase.co';
const PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZHB0Y3V3cG5ldXl6amF2amFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjQzNjYsImV4cCI6MjEwNTA0MDM2Nn0.jbIzvkqQ7qnYhH45uvIwDI97-tjdHsPY4S-0yv9XBXg';

module.exports = {
  expo: {
    ...app.expo,
    extra: {
      youtubeDataApiKey: env('YOUTUBE_DATA_API_KEY') || env('EXPO_PUBLIC_YOUTUBE_DATA_API_KEY'),
      supabaseUrl: env('EXPO_PUBLIC_SUPABASE_URL', PUBLIC_SUPABASE_URL),
      supabaseAnonKey:
        env('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
        env('SUPABASE_ANON_KEY') ||
        env('SUPABASE_PUBLISHABLE_KEY') ||
        env('JWT', PUBLIC_SUPABASE_ANON_KEY),
      videoReviewEnabled: env('VIDEO_REVIEW_ENABLED', 'false') === 'true',
    },
  },
};
