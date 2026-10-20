import test from 'node:test';
import assert from 'node:assert/strict';
import { investigationComplete } from '../investigationStages';
import type { ProductProfile } from '../../types';

test('reviewed first-batch evidence can reveal while the rest continues', () => {
  const profile = { parallelResearch: { phase: 'batch1' }, presentation: { dimensionExperience: {} } } as unknown as ProductProfile;
  assert.equal(investigationComplete(false, profile), true);
});
test('a freshly queued profile cannot reveal just because facts/findings exist', () => {
  const profile = { parallelResearch: { phase: 'discovering' }, findings: {}, presentation: undefined } as unknown as ProductProfile;
  assert.equal(investigationComplete(false, profile), false);
});
