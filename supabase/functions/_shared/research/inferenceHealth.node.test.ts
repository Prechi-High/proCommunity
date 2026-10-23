import test from 'node:test';import assert from 'node:assert/strict';
import {requireInferenceHealth} from './inferenceHealth.js';
test('disabled workspace is a permanent refusal rather than a retryable missing model',async()=>{
 await assert.rejects(()=>requireInferenceHealth(new Response('modal-http: workspace account-id is disabled',{status:404})),(e:any)=>e.permanent===true&&e.message==='inference_workspace_disabled');
});
test('ordinary startup failures retain bounded retry behavior',async()=>{
 await assert.rejects(()=>requireInferenceHealth(new Response('temporarily unavailable',{status:503})),(e:any)=>!e.permanent&&e.message==='modal_startup_http_503');
 await requireInferenceHealth(new Response('{"ready":true}',{status:200}));
});
