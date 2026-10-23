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
 const t={kind:'identity',state:'done',created_at:start,first_started_at:'2026-10-21T10:00:02Z',finished_at:'2026-10-21T10:00:05Z',total_processing_ms:3000,provider_wait_ms:400,capacity_deferrals:2};
 const s=stageTimings([t],start,Date.parse(start)+6000);
 assert.equal(s.stages.identity.queueMs,2000);assert.equal(s.stages.identity.processingMs,3000);assert.equal(s.stages.identity.deferrals,2);assert.equal(s.elapsedMs,6000);assert.equal(s.stages.identity.providerWaitMs,400);
});

import {boundedCommentPage,supportedVideoIdentity,assessmentTasks} from './logic.js';
test('video budget retains 200 unique comments across pages and replies in groups of eight',()=>{
 const records=Array.from({length:230},(_,i)=>({id:String(i),text:'experience '+i}));
 const first=boundedCommentPage(records.slice(0,100));
 const second=boundedCommentPage(records.slice(90),first.seenCommentIds);
 assert.equal(second.records.length,100);
 assert.equal(second.seenCommentIds.length,200);
 assert.equal(second.remainingComments,0);
 assert.equal(boundedCommentPage(records,second.seenCommentIds).records.length,0);
 const tasks=assessmentTasks([...first.records,...second.records],'video',1);
 assert.equal(tasks.length,25);assert.ok(tasks.every(t=>t.payload.records.length===8));
 assert.equal(boundedCommentPage(records).records.length,200);
});
test('identity approval requires a real reference to the correct product form',()=>{
 const identity={name:'Dior Miss Dior Comforting Body Cream',brand:'Dior'};
 const judge=(reference:string)=>({exact:true,confidence:.95,reference});
 assert.equal(supportedVideoIdentity({title:'Dior Miss Dior Essence Review'},judge('Dior Miss Dior Essence'),identity),false);
 assert.equal(supportedVideoIdentity({title:'Dior j’adore Golden Shimmering Gel'},judge('Dior j’adore Golden Shimmering Gel'),identity),false);
 const video={title:'Dior beauty collection',description:'12:56 Miss Dior Comforting Body Cream'};
 assert.equal(supportedVideoIdentity(video,judge('Miss Dior Comforting Body Cream'),identity),true);
 assert.equal(supportedVideoIdentity(video,judge('Dior Moisturizing Body Cream'),identity),false);
});
