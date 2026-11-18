/**
 * Headless smoke for studio audio URLs + catalog integrity.
 * Run: node scripts/studio-smoke.mjs
 */
const sounds = [
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  "https://remotion.media/audio.mp3",
];

let failed = 0;
for (const url of sounds) {
  const res = await fetch(url, { method: "HEAD" });
  const ok = res.ok && String(res.headers.get("content-type") || "").includes("audio");
  console.log(ok ? "OK " : "FAIL", url, res.status, res.headers.get("content-type"));
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`studio-smoke: ${failed} audio URL(s) failed`);
  process.exit(1);
}
console.log("studio-smoke: all audio URLs reachable");
