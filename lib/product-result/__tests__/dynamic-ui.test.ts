import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { navigationFromContract } from '../contract';
import type { ProductUIContractV1 } from '../contract';

function contractFixture(productType: string, dims: string[]): ProductUIContractV1 {
  return {
    schema_version: '1',
    product: {
      id: 'p1',
      name: 'Test',
      domain: { id: 'd1', name: 'Tech', status: 'official' },
      product_type: productType,
    },
    navigation: [
      { key: 'overview', label: 'Overview', section_ref: 'overview', display_order: 0, enabled: true },
      { key: 'specs', label: productType === 'foundation' ? 'Ingredients' : 'Specs', section_ref: 'specs', display_order: 1, enabled: true },
      { key: 'evidence', label: 'Evidence', section_ref: 'evidence', display_order: 2, enabled: true },
      { key: 'videos', label: 'Videos', section_ref: 'videos', display_order: 3, enabled: true },
      { key: 'ask', label: 'Ask', section_ref: 'ask', display_order: 4, enabled: true },
    ],
    overview: {
      dimensions: dims.map((k, i) => ({
        id: k,
        key: k,
        label: k.replace(/_/g, ' '),
        display_order: i,
      })),
    },
    sections: [],
    intelligence_meta: {
      blueprint_id: 'bp1',
      blueprint_version: 2,
      generated_at: new Date().toISOString(),
    },
  };
}

describe('dynamic UI contract navigation', () => {
  it('foundation uses Ingredients not Camera dimensions', () => {
    const c = contractFixture('foundation', ['coverage', 'oxidation', 'transfer_resistance', 'wear_longevity']);
    const nav = navigationFromContract(c);
    assert.ok(nav.some((n) => n.label === 'Ingredients'));
    assert.ok(!c.overview.dimensions.some((d) => d.key === 'camera_quality'));
  });

  it('air fryer dimensions exclude beauty keys', () => {
    const c = contractFixture('air_fryer', ['cooking_consistency', 'noise', 'ease_of_cleaning', 'capacity_usability']);
    assert.ok(!c.overview.dimensions.some((d) => ['coverage', 'pigmentation'].includes(d.key)));
  });
});
