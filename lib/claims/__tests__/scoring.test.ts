import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeRawClaimScore, findingLabelFromScore, scoringGates } from '../scoring';

describe('claim agreement scoring', () => {
  it('2 support + 2 partial + 1 conflict => 6.0', () => {
    const raw = computeRawClaimScore({ support: 2, partial: 2, contradict: 1, excluded: 0 });
    assert.equal(raw, 6);
  });

  it('all support => 10', () => {
    assert.equal(computeRawClaimScore({ support: 5, partial: 0, contradict: 0, excluded: 0 }), 10);
  });

  it('all conflict => 0 when gates pass', () => {
    const { score } = scoringGates({
      identityExact: true,
      hasCriterion: true,
      claimType: 'general',
      counts: { support: 0, partial: 0, contradict: 5, excluded: 0 },
      distinctOwnerUnits: 5,
      independentOrigins: 2,
      hasMaterialTestConflict: false,
      hasIndependentTestCorroboration: false,
      contextCompleteRatio: 0.9,
    });
    assert.equal(score, 0);
  });

  it('four owners fails gate', () => {
    const { score, unavailableReason } = scoringGates({
      identityExact: true,
      hasCriterion: true,
      claimType: 'general',
      counts: { support: 2, partial: 2, contradict: 0, excluded: 0 },
      distinctOwnerUnits: 4,
      independentOrigins: 2,
      hasMaterialTestConflict: false,
      hasIndependentTestCorroboration: false,
      contextCompleteRatio: 0.9,
    });
    assert.equal(score, null);
    assert.equal(unavailableReason, 'insufficient_owners');
  });

  it('finding labels use raw thresholds', () => {
    assert.equal(findingLabelFromScore(8, false), 'Supported by collected reports');
    assert.equal(findingLabelFromScore(6, false), 'Mixed');
    assert.equal(findingLabelFromScore(2.9, false), 'Contradicted by collected reports');
  });
});
