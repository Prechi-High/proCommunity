import test from 'node:test';import assert from 'node:assert/strict';import {atomicBlueprintWrites} from './atomicBlueprint.js';
test('blueprint writes remain ordered in one transaction and effects follow its commit',async()=>{
 const order:string[]=[],saved:any[]=[];
 const result=await atomicBlueprintWrites({rpc:async(name:string,args:any)=>{assert.equal(name,'research_blueprint_batch');saved.push(...args.p_ops);order.push('commit');return true;}},{id:'t',lease:'l'},async(store:any)=>{
  await store.upsert('product_blueprints',{id:'b'});await store.remove('evaluation_dimensions','blueprint_id=eq.b');await store.insertMany('evaluation_dimensions',[{id:'d'}]);store.afterCommit(async()=>{order.push('invalidate');});return 'presentation';});
 assert.equal(result,'presentation');assert.deepEqual(saved.map(x=>x.kind),['upsert','remove','insert']);assert.deepEqual(order,['commit','invalidate']);
});
test('a lost publication lease prevents cache side effects',async()=>{
 let called=false;await assert.rejects(()=>atomicBlueprintWrites({rpc:async()=>false},{id:'t',lease:'l'},async(store:any)=>{store.afterCommit(async()=>{called=true;});}),/publication_lease_lost/);assert.equal(called,false);
});
