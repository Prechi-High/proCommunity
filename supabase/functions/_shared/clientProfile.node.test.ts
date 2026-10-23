import assert from 'node:assert/strict';
import test from 'node:test';
import { clientProductProfile } from './clientProfile';
test('rendering payload retains evidence and counters without copying internal assessment audits',()=>{
 const evidence={text:'Absorbs quickly but made me itch',quote:'made me itch',parent:'Context'};
 const profile={semanticReview:{rows:[{id:'c1',...evidence}],decisions:{c1:{status:'accepted',row:evidence},c2:{status:'rejected',reason:'social'}},pending:0},dimensionExperience:{byKey:{comfort:{evidence:[evidence]}}},presentation:{overview:{},dimensionExperience:{normalizedRows:[evidence]}},conversationEvidence:[evidence]};
 const before=JSON.stringify(profile),out=clientProductProfile(profile);
 assert.deepEqual(out.dimensionExperience,profile.dimensionExperience);
 assert.deepEqual(out.conversationEvidence,profile.conversationEvidence);
 assert.equal(out.semanticReview.rows.length,1);assert.equal(Object.keys(out.semanticReview.decisions).length,2);
 assert.equal(out.semanticReview.decisions.c1.status,'accepted');
 assert.equal('dimensionExperience' in out.presentation,false);
 assert.equal(JSON.stringify(profile),before);
});
test('legacy presentation evidence remains when no top-level replacement exists',()=>{
 const p={presentation:{dimensionExperience:{normalizedRows:[{id:'a'}]}}};assert.deepEqual(clientProductProfile(p),p);
});
