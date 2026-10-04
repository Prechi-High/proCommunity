export type ThemeVoice = { ref: string; mark: string; stance: string; topic: string; text?: string };

export type OwnerThemeRow = {
  topic: string;
  summary: string;
  origin: 'owner' | 'brand';
  voiceRefs: string[];
  brandSource?: number;
  conditions?: string;
};

export type OwnerThemeRaw = {
  topic?: string;
  summary?: string;
  refs?: string[];
};

export function expandVoicesForThemes(
  voices: ThemeVoice[],
  praise: Array<{ text: string; source: number | null }>,
  complaints: Array<{ text: string; source: number | null }>,
): ThemeVoice[] {
  const out: ThemeVoice[] = [...voices];
  const seen = new Set(voices.map((v) => (v.text || v.mark).trim().toLowerCase()).filter(Boolean));
  praise.forEach((p, i) => {
    const text = p.text.trim();
    if (!text || seen.has(text.toLowerCase())) return;
    seen.add(text.toLowerCase());
    out.push({
      ref: `P${i + 1}`,
      mark: text.split(/\s+/).slice(0, 6).join(' '),
      stance: 'love',
      topic: topicFromVoiceText(text),
      text,
    });
  });
  complaints.forEach((c, i) => {
    const text = c.text.trim();
    if (!text || seen.has(text.toLowerCase())) return;
    seen.add(text.toLowerCase());
    out.push({
      ref: `X${i + 1}`,
      mark: text.split(/\s+/).slice(0, 6).join(' '),
      stance: 'warn',
      topic: topicFromVoiceText(text),
      text,
    });
  });
  return out;
}

export function buildOwnerThemeRows(
  voices: ThemeVoice[],
  ownerClaimsRaw: OwnerThemeRaw[],
  brandClaims: Array<{ topic?: string; exact_text?: string; brand_source?: number; conditions?: string }>,
): OwnerThemeRow[] {
  const pool = voices.filter((v) => (v.text || v.mark || '').trim().length > 8);
  const rows: OwnerThemeRow[] = [];
  const usedRefs = new Set<string>();

  for (const raw of ownerClaimsRaw) {
    const topic = String(raw.topic || '').trim();
    const summary = String(raw.summary || '').trim();
    const refs = Array.isArray(raw.refs) ? raw.refs.map((r) => String(r).trim()).filter(Boolean) : [];
    const matched = pool.filter((v) => refs.some((r) => r.toUpperCase() === v.ref.toUpperCase()));
    if (!topic || !summary || !matched.length) continue;
    matched.forEach((v) => usedRefs.add(v.ref));
    rows.push({ topic: topic.slice(0, 80), summary: summary.slice(0, 400), origin: 'owner', voiceRefs: matched.map((v) => v.ref) });
  }

  for (const group of clusterVoicesByTopic(pool.filter((v) => !usedRefs.has(v.ref)))) {
    if (group.length < 1) continue;
    const topic = displayTopic(group);
    const summary = summarizeOwnerTheme(group, topic);
    group.forEach((v) => usedRefs.add(v.ref));
    rows.push({
      topic,
      summary,
      origin: 'owner',
      voiceRefs: group.map((v) => v.ref),
    });
  }

  for (const b of brandClaims) {
    const topic = String(b.topic || '').trim();
    const summary = String(b.exact_text || '').trim();
    if (!topic || !summary || isGenericBrand(topic, summary)) continue;
    const related = pool.filter((v) => !usedRefs.has(v.ref) && voiceTouchesTopic(v, topic, summary));
    if (!related.length) continue;
    related.forEach((v) => usedRefs.add(v.ref));
    rows.push({
      topic: topic.slice(0, 80),
      summary,
      origin: 'brand',
      voiceRefs: related.map((v) => v.ref),
      brandSource: b.brand_source,
      conditions: b.conditions,
    });
  }

  return rows
    .sort((a, b) => b.voiceRefs.length - a.voiceRefs.length)
    .slice(0, 8);
}

function clusterVoicesByTopic(voices: ThemeVoice[]): ThemeVoice[][] {
  const groups: ThemeVoice[][] = [];
  for (const v of voices) {
    const key = normalizeTopicKey(v.topic, v.text || v.mark);
    let target: ThemeVoice[] | undefined;
    for (const g of groups) {
      const gKey = normalizeTopicKey(g[0].topic, g[0].text || g[0].mark);
      if (key === gKey || tokenOverlap(key, gKey) > 0.45) {
        target = g;
        break;
      }
    }
    if (target) target.push(v);
    else groups.push([v]);
  }
  return groups.filter((g) => g.length > 0).sort((a, b) => b.length - a.length);
}

function displayTopic(group: ThemeVoice[]): string {
  const fromLlm = group.map((v) => v.topic.trim()).find((t) => t.length >= 3);
  if (fromLlm) return fromLlm.charAt(0).toUpperCase() + fromLlm.slice(1);
  return topicFromVoiceText(group[0].text || group[0].mark);
}

export function summarizeOwnerTheme(group: ThemeVoice[], topic: string): string {
  const loves = group.filter((v) => v.stance === 'love').length;
  const warns = group.filter((v) => v.stance === 'warn').length;
  const mixed = group.length - loves - warns;
  const t = topic.toLowerCase();
  if (loves > warns && loves >= warns + mixed) {
    return `Owners and reviewers often speak positively about ${t} in comments and discussions.`;
  }
  if (warns > loves && warns >= loves + mixed) {
    return `Owners and reviewers frequently raise concerns about ${t}.`;
  }
  if (mixed >= loves && mixed >= warns) {
    return `People talk about ${t} with mixed experiences — worth reading the threads below.`;
  }
  return `A recurring theme in owner discussions: ${t}.`;
}

function voiceTouchesTopic(v: ThemeVoice, topic: string, blob: string): boolean {
  const hay = `${topic} ${blob}`.toLowerCase();
  const words = `${v.topic} ${v.text || ''} ${v.mark}`.toLowerCase();
  return tokenOverlap(hay, words) > 0.12;
}

function isGenericBrand(topic: string, text: string): boolean {
  const t = topic.toLowerCase();
  if (t === 'performance' || t === 'durability' || t === 'quality') return true;
  return /manufacturer information unavailable/i.test(text);
}

function normalizeTopicKey(topic: string, text: string): string {
  const t = topic.trim().toLowerCase();
  if (t.length >= 3) return t;
  return topicFromVoiceText(text).toLowerCase();
}

function topicFromVoiceText(text: string): string {
  let s = text.replace(/^[\s•\-*]+/, '').trim().split(/[.;:!?—–\n]/)[0].trim();
  const words = s.split(/\s+/).filter(Boolean);
  const skip = new Set(['the', 'a', 'an', 'this', 'that', 'with', 'for', 'and', 'or', 'is', 'are', 'to', 'in', 'on', 'it', 'its', 'my', 'i', 'we']);
  const pick = words.filter((w) => !skip.has(w.toLowerCase())).slice(0, 4);
  const label = pick.join(' ') || words.slice(0, 3).join(' ') || 'This product';
  return label.charAt(0).toUpperCase() + label.slice(1).slice(0, 56);
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  ta.forEach((w) => {
    if (tb.has(w)) hit += 1;
  });
  return hit / Math.max(ta.size, tb.size);
}
