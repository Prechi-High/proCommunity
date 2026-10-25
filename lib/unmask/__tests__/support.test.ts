import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkProgress, combinedSupport, publicUnmaskStage } from '../status';
test('targets use the editorial value without hiding support above the goal', () => {
 assert.deepEqual(sparkProgress(800, 750), { weight: 800, goal: 750, ratio: 1, remaining: 0, ready: true });
 assert.equal(sparkProgress(0, 500).ratio, 0);
 assert.equal(sparkProgress(250, 1000).ratio, .25);
});
test('invalid values do not create NaN progress or negative support', () => {
 assert.equal(sparkProgress(-10, 0).weight, 0);
 assert.equal(sparkProgress(NaN, NaN).goal, 500);
 assert.equal(sparkProgress(Infinity).ratio, 0);
});
test('Thunder adds support weight and workflow stages remain separate', () => {
 assert.equal(combinedSupport(75, 2), 275);
 assert.equal(publicUnmaskStage('published'), 'unmasked');
 assert.equal(publicUnmaskStage('selected'), 'picked');
});
