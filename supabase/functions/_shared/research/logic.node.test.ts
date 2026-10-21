import test from "node:test";
import assert from "node:assert/strict";
import { logicSelfTest } from "./logic.js";
test("parallel research scheduling and aggregation regressions", () => {
  assert.equal(logicSelfTest().passed, 9);
});

import {identityNeedsConfirmation,discoveryName,rankedCandidates,stageTimings} from './logic.js';
test('generic selected names require identity confirmation without inventing a brand',()=>{
 assert.equal(identityNeedsConfirmation({name:'Travel Size Body Butter',brand:''}),true);
 assert.equal(identityNeedsConfirmation({name:'Travel Size Body Butter',brand:'The Body Shop'}),false);
 assert.equal(identityNeedsConfirmation({name:'CeraVe Moisturizing Cream',brand:''}),false);
 assert.equal(discoveryName({name:'Butter',brand:'Example'}),'Example Butter');
 assert.equal(discoveryName({name:'Example Butter',brand:'Example'}),'Example Butter');
});
test('video ranking prioritizes exact names without treating ranking as acceptance',()=>{
 const videos=[{id:'wrong',title:'Other body cream'},{id:'right',title:'CeraVe Moisturizing Cream review'}];
 assert.equal(rankedCandidates(videos,{name:'CeraVe Moisturizing Cream'})[0].id,'right');
 assert.equal(rankedCandidates(videos,{name:'CeraVe Moisturizing Cream'}).length,2);
});
test('stage timings distinguish queue delay, processing and capacity deferrals',()=>{
 const start='2026-10-21T10:00:00Z';
 const t={kind:'identity',state:'done',created_at:start,first_started_at:'2026-10-21T10:00:02Z',finished_at:'2026-10-21T10:00:05Z',total_processing_ms:3000,capacity_deferrals:2};
 const s=stageTimings([t],start,Date.parse(start)+6000);
 assert.equal(s.stages.identity.queueMs,2000);assert.equal(s.stages.identity.processingMs,3000);assert.equal(s.stages.identity.deferrals,2);assert.equal(s.elapsedMs,6000);
});
