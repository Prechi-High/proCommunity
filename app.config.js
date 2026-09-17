const app = require('./app.json');

module.exports = {
  expo: {
    ...app.expo,
    extra: {
      youtubeDataApiKey: process.env.YOUTUBE_DATA_API_KEY ?? process.env.EXPO_PUBLIC_YOUTUBE_DATA_API_KEY ?? '',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
};
