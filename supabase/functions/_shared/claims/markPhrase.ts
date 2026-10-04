export function markPhraseInText(summary: string, preferred?: string | null): string {
  const p = (preferred || '').trim();
  if (p.length > 2 && summary.toLowerCase().includes(p.toLowerCase())) return p;
  const neg =
    /\b(broke|broken|failed|fail|don't|doesn't|didn't|not|never|worst|terrible|bad|poor|disappoint|return|refund|junk|hate|useless|overheat|leak|crack|scratch|slow|loud|noisy|drain|die|died|dead|regret|avoid)\b/i;
  const words = summary.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (neg.test(words[i])) return words.slice(i, Math.min(i + 6, words.length)).join(' ');
  }
  return words.slice(0, Math.min(5, words.length)).join(' ');
}
