const site = process.argv[2] || 'https://pro-community.vercel.app';
const html = await (await fetch(site)).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const src = scripts[0];
const abs = src.startsWith('http') ? src : new URL(src, site).toString();
const js = await (await fetch(abs)).text();

const needles = [
  'aqdptcuwpneuyzjavjak',
  'supabase.co',
  'youtubeDataApiKey',
  'supabaseUrl',
  'supabaseAnonKey',
  'AIzaSy',
  'discover-video-content',
  'functions/v1',
  'EXPO_PUBLIC_SUPABASE',
  'pending_review',
];

const hits = {};
for (const needle of needles) {
  const i = js.indexOf(needle);
  hits[needle] = i === -1 ? null : { index: i, around: js.slice(Math.max(0, i - 80), i + needle.length + 80) };
}
console.log(JSON.stringify({ src, len: js.length, hits }, null, 2));
