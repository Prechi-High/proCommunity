import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewEvidence, validateReviewDecision, type ReviewRecord } from '../semanticReview.ts';
import { buildDimensionExperiencePackage } from '../pipeline.ts';
import { evidenceSegments } from '../../../../../lib/unmask/evidenceHighlights.ts';
import { loadCommunityEvidence } from '../communityEvidence.ts';
import { validateProductVideos } from '../videoIdentity.ts';
const dimensions = [{ key: 'absorption', label: 'Absorption', keywords: [], importance: 1 }, { key: 'irritation', label: 'Irritation', keywords: [], importance: 1 }];
const record: ReviewRecord = { id: 'youtube:1', sourceId: '1', text: 'It sinks in quickly, but my cheeks started stinging after three days.', platform: 'youtube', url: 'https://youtube.com/watch?v=a&lc=1', author: 'A' };
const answer = { id: record.id, exactProduct: true, firsthand: true, confidence: 0.95, reason: 'Direct experience of target product', categories: [
 { key: 'absorption', quote: 'sinks in quickly', stance: 'positive', confidence: 0.9 },
 { key: 'irritation', quote: 'my cheeks started stinging after three days', stance: 'negative', confidence: 0.9 } ] };
test('one original comment has independent category quotes and stances', () => {
 const d = validateReviewDecision(record, answer, dimensions, 'hash');
 assert.equal(d?.status, 'accepted');
 const pkg = buildDimensionExperiencePackage({ productId: 'x', blueprintId: 'b', query: 'cream', profile: { identity: { name: 'cream' }, semanticReviewRequired: true, semanticReview: { version: 'semantic-review-v1', rows: [d!.row!] } }, dimensions }).package;
 assert.equal(pkg.byKey.absorption.items[0].stance, 'positive');
 assert.equal(pkg.byKey.irritation.items[0].stance, 'negative');
 for (const key of ['absorption', 'irritation']) {
  const item = pkg.byKey[key].items[0];
  const parts = evidenceSegments(item.fullText!, item.highlightSpans);
  assert.equal(parts.map(p => p.text).join(''), record.text);
  assert.equal(parts.filter(p => p.highlighted).map(p => p.text).join(''), item.statement);
 }
});
test('unrelated parent spam, invented quotes and unsupported categories cannot enter scores', () => {
 assert.equal(validateReviewDecision(record, { ...answer, exactProduct: false, categories: [] }, dimensions, 'h')?.status, 'rejected');
 assert.equal(validateReviewDecision(record, { ...answer, categories: [{ key: 'absorption', quote: 'an invented statement', confidence: 1, stance: 'positive' }] }, dimensions, 'h')?.status, 'rejected');
 assert.equal(validateReviewDecision(record, { ...answer, categories: [{ key: 'battery', quote: 'sinks in quickly', confidence: 1, stance: 'positive' }] }, dimensions, 'h')?.status, 'rejected');
 const pkg = buildDimensionExperiencePackage({ productId: 'x', blueprintId: 'b', query: 'Passion', profile: { semanticReviewRequired: true, voices: [{ text: 'and this person feels bad about their passion' }] }, dimensions });
 assert.equal(pkg.rows.length, 0);
});
test('checkpoints allow unchanged comments to resume without another LLM charge', async () => {
 let calls = 0;
 const call = async () => { calls++; return { data: { decisions: [answer] }, model: 'test', errors: [], usage: { inputTokens: 100, outputTokens: 50, thinkingTokens: 0 } }; };
 const a = await reviewEvidence({ identity: 'cream', dimensions, records: [record], call });
 const b = await reviewEvidence({ identity: 'cream', dimensions, records: [record], previous: a, call });
 assert.equal(calls, 1); assert.equal(b.complete, true); assert.equal(b.usage[0].usage?.inputTokens, 100);
 const c = await reviewEvidence({ identity: 'other variant', dimensions, records: [record], previous: b, call });
 assert.equal(calls, 2);
 const removed = await reviewEvidence({ identity: 'cream', dimensions, records: [], previous: a, call });
 assert.equal(removed.rows.length, 0);
});
test('failed batch stays pending; duplicates and hallucinated IDs do not pass', async () => {
 const result = await reviewEvidence({ identity: 'cream', dimensions, records: [record], call: async () => ({ data: { decisions: [answer, answer] }, model: 'test', errors: [] }) });
 assert.equal(result.pending, 1); assert.equal(result.complete, false); assert.equal(result.rows.length, 0);
});
test('only exact-product videos accepted by semantic review enter collection', async () => {
 const videos = ['iPhone 15', 'iPhone 15 Pro', 'phones'].map((title, i) => ({ id: String(i), title, description: '', videoRelevanceScore: 1, matchedQueryTopics: [] }));
 const result = await validateProductVideos(videos, { productName: 'iPhone 15 Pro' }, { call: async () => ({ data: { videos: [{ id: '0', accepted: false, reason: 'wrong variant' }, { id: '1', accepted: true, reason: 'exact model' }] }, model: 'test', errors: [] }) });
 assert.deepEqual(result.map(v => v.id), ['1']);
});
test('community collection restricts both journey and update publication explicitly', async () => {
 const paths: string[] = [];
 await loadCommunityEvidence({ rows: async p => { paths.push(p); return p.startsWith('unmask_journeys?') ? [{ id: '123-ab' }] : []; } }, 'product');
 assert.ok(paths[0].startsWith('clarity_experiences?'));
 assert.ok(paths[0].includes('visibility=eq.public'));
 assert.ok(paths.find(p => p.startsWith('unmask_journeys?'))?.includes('visibility=eq.public'));
 assert.ok(paths.find(p => p.startsWith('unmask_experience_updates?'))?.includes('moderation_status=eq.published&is_demo=eq.false'));
});
test('community and YouTube reports contribute together while repeated authors count once', () => {
 const decisions = Array.from({ length: 22 }, (_, i) => {
   const r = { ...record, id: `source:${i}`, sourceId: String(i), author: `person${i === 21 ? 0 : i}`, platform: i < 10 ? 'community' : 'youtube', conversationId: `discussion${i % 3}` };
   return validateReviewDecision(r, { ...answer, id: r.id }, dimensions, 'h')!.row!;
 });
 // Ensure a repeated report from the SAME source/person is excluded.
 decisions.push({ ...decisions[0], evidenceId: 'duplicate' });
 const pkg = buildDimensionExperiencePackage({ productId: 'x', blueprintId: 'b', query: 'cream', profile: { semanticReviewRequired: true, semanticReview: { version: 'semantic-review-v1', rows: decisions } }, dimensions }).package;
 const bundle = pkg.byKey.absorption;
 assert.equal(bundle.items.filter(i => i.affectsScore).length, 22);
 assert.equal(bundle.score, 100);
 assert.ok(bundle.items.some(i => i.platform === 'community' && i.affectsScore));
 assert.ok(bundle.items.some(i => i.platform === 'youtube' && i.affectsScore));
});
test('a timed-out YouTube page is contained instead of rejecting the entire harvest', async () => {
 const { withTimeout } = await import('../providers/youtube/harvest.ts');
 const aborted = Promise.reject(new DOMException('Signal timed out', 'TimeoutError'));
 assert.equal(await withTimeout(aborted, 50), null);
 assert.deepEqual(await withTimeout(Promise.resolve({ items: ['previously collected'] }), 50), { items: ['previously collected'] });
});

test('database JSON key ordering does not discard reviewed evidence or spend another LLM call', async () => {
 let calls = 0;
 const call = async () => { calls++; return { data: { decisions: [answer] }, model: 'test', errors: [] }; };
 const first = await reviewEvidence({ identity: { name: 'Cream', brand: 'Brand' }, dimensions, records: [record], call });
 const reordered = dimensions.map(d => ({ importance: d.importance, keywords: d.keywords, label: d.label, key: d.key }));
 const second = await reviewEvidence({ identity: { brand: 'Brand', name: 'Cream' }, dimensions: reordered, records: [record], previous: JSON.parse(JSON.stringify(first)), call });
 assert.equal(calls, 1);
 assert.equal(second.rows.length, 1);
});
