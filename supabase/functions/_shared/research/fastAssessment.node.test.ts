import test from 'node:test';
import assert from 'node:assert/strict';
import {fastAssessmentFormat,decodeFastAssessment} from './fastAssessment.js';
import {validateReviewDecision} from '../evidence/semanticReview.ts';
const run={identity:{name:'Example Body Cream'},blueprint:{dimensions:[{key:'hydration',label:'Hydration'},{key:'skin_comfort',label:'Comfort'}]}};
const records=[{id:'a',text:'It kept my skin soft, but it made me itch.',title:'Example Body Cream',platform:'youtube',sourceId:'a',url:''},{id:'b',text:'Can I use this?',platform:'youtube',sourceId:'b',url:''}];
test('sparse responses preserve multi-category sentiment and evidence quotes',()=>{
 const d=decodeFastAssessment(run,records,{e:[{i:'1',c:.95,a:'',k:[['hydration','positive','kept my skin soft',.95],['skin_comfort','negative','made me itch',.95]],u:[]}],x:['2']});
 const valid=validateReviewDecision(records[0],d.decisions[0],run.blueprint.dimensions,'h',run.identity);
 assert.equal(valid?.status,'accepted');assert.deepEqual(valid?.row?.dimensionLinks.map(l=>l.stance),['positive','negative']);assert.equal(d.decisions[1].exactProduct,false);
});
test('duplicate or omitted IDs remain unresolved instead of becoming rejected evidence',()=>{
 const d=decodeFastAssessment(run,records,{e:[],x:['1','1']});assert.equal(d.decisions.length,0);
 assert.equal(decodeFastAssessment(run,records,{e:[]}),null);
});
test('sparse schema bounds category and observation output',()=>{
 const s=fastAssessmentFormat(8,2).json_schema.schema.properties;
 assert.equal(s.e.maxItems,8);assert.equal(s.e.items.properties.k.maxItems,12);assert.equal(s.e.items.properties.u.maxItems,2);
});
test('a borrowed quote cannot become accepted evidence',()=>{
 const d=decodeFastAssessment(run,records,{e:[{i:'1',c:.95,a:'',k:[['hydration','positive','my skin stayed hydrated',.95]],u:[]}],x:['2']});
 assert.equal(validateReviewDecision(records[0],d.decisions[0],run.blueprint.dimensions,'h',run.identity)?.status,'rejected');
});
