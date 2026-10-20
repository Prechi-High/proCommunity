export type HighlightSpan = { start: number; end: number };
/** Offsets reference the original string; invalid/model-invented spans are never rendered. */
export function evidenceSegments(text: string, spans: HighlightSpan[] = []) {
  const valid = spans.filter(s => Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end > s.start && s.end <= text.length)
    .sort((a, b) => a.start - b.start);
  const merged: HighlightSpan[] = [];
  for (const span of valid) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let at = 0;
  for (const span of merged) {
    if (span.start > at) parts.push({ text: text.slice(at, span.start), highlighted: false });
    parts.push({ text: text.slice(span.start, span.end), highlighted: true });
    at = span.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), highlighted: false });
  return parts;
}
