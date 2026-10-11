type EdgeRuntimeLike = { waitUntil(p: Promise<unknown>): void };

/** Continue investigation after returning HTTP response (Supabase Edge). */
export function runInBackground(p: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else void p;
}
