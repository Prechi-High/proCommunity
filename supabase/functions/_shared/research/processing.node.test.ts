import test from "node:test";
import assert from "node:assert/strict";
import { assessComments, verifyComments, evidenceResults, validateVerification, decisionHash } from "./processing.js";
import { researchCaller, ProviderWait, screenComments, retryDelay, responseFormat, providerCandidates, providerStatus } from "./providers.js";

const run={id:"run",product_id:"cream",identity:{name:"Example Cream",brand:"Example"},blueprint:{dimensions:[{key:"hydration",label:"Hydration",importance:1,keywords:[]}]}};
const record=(id:string,text="It kept my skin hydrated all day.")=>({id,sourceId:id,platform:"youtube",text,url:"https://youtube.com/watch?v=x",title:"Example Cream Review",conversationId:"x"});
function memory(){
 const checkpoints:any[]=[];const children:any[]=[];const cache:any[]=[];
 return {checkpoints,children,cache,
  rows:async()=>cache,
  upsertOn:async(_t:string,rows:any[])=>{for(const row of rows){const i=cache.findIndex(x=>x.input_hash===row.input_hash);if(i>=0)cache[i]=row;else cache.push(row);}},
  rpc:async(name:string,args:any)=>{if(name==="research_checkpoint"){checkpoints.push(structuredClone(args.p_result));children.push(...(args.p_children||[]));return true;}throw Error(name);}};
}
const rejected=(id:string)=>({id,exactProduct:false,firsthand:false,confidence:.95,reason:"Unrelated social conversation",categories:[]});
const accepted=(id:string)=>({id,exactProduct:true,firsthand:true,confidence:.96,reason:"Direct product experience",categories:[{key:"hydration",quote:"kept my skin hydrated",stance:"positive",confidence:.96,reason:"Hydration experience"}]});
const skipFilter=async()=>{throw Error("not configured");};

test("partial primary decisions survive retry and accepted evidence waits for verification",async()=>{
 const store=memory(), records=[record("a"),record("b","Great creator!")];
 const task:any={id:"task",lease:"lease",task_key:"group",kind:"review",batch:1,attempts:1,payload:{records}};
 await assert.rejects(()=>assessComments(store,run,task,async()=>({data:{decisions:[accepted("a")]},model:"mock",errors:[]}),skipFilter),/incomplete:1/);
 assert.equal(store.children.length,1);
 const checkpoint=store.checkpoints.at(-1);
 assert.equal(evidenceResults([{...task,result:checkpoint,state:"pending"}])[0].decisions.a,undefined);
 let sent:string[]=[];
 const out=await assessComments(store,run,{...task,attempts:2,result:checkpoint},async(records:any[])=>{
  sent=records.map(r=>r.id);return {data:{decisions:[rejected("b")]},model:"mock",errors:[]};},skipFilter);
 assert.deepEqual(sent,["b"]);assert.equal(store.children.length,1);
 assert.equal(out.result.assessmentState.decisions.a.status,"accepted");
 const child=store.children[0];
 const verified=await verifyComments(store,run,{id:"verify",lease:"v",payload:child.payload},async()=>({data:{keep:[{id:"a",type:"experience",keys:["hydration"]}]},model:"mock",errors:[]}));
 assert.equal(evidenceResults([{kind:"verify",state:"done",result:verified.result}])[0].decisions.a.status,"accepted");
});

test("verified cache reuse performs no new assessment or verification calls",async()=>{
 const store=memory(),r=record("a");
 const hash=await decisionHash(run,r);
 store.cache.push({input_hash:hash,decision:{inputHash:hash,status:"rejected",reason:"No experience"}});
 let calls=0;
 const out=await assessComments(store,run,{id:"t",lease:"l",payload:{records:[r]}},async()=>{calls++;throw Error("unexpected");},skipFilter);
 assert.equal(calls,0);assert.equal(store.children.length,0);assert.equal(out.result.reused.a.status,"rejected");
});

test("verification ignores unknown and duplicate IDs and never borrows a new category",()=>{
 const records=[record("a")], proposed={a:{inputHash:"h",status:"accepted",row:{dimensionLinks:[{dimensionKey:"hydration"}]}}};
 assert.deepEqual(validateVerification(records,proposed,{keep:[{id:"unknown",type:"experience",keys:["hydration"]}]}),{});
 assert.deepEqual(validateVerification(records,proposed,{keep:[{id:"a",type:"experience",keys:[]},{id:"a",type:"experience",keys:["hydration"]}]}),{});
 assert.equal(validateVerification(records,proposed,{keep:[{id:"a",type:"experience",keys:["irritation"]}]}).a.status,"rejected");
});

test("shadow filtering and filter failures retain every comment",async()=>{
 const records=[record("a"),record("b")];
 const screened=await screenComments(async()=>({data:{items:records.map(r=>({id:r.id,keep:false,confidence:1,reason:"spam"}))}}),run,records,"shadow");
 assert.equal(screened.records.length,2);assert.equal(screened.decisions.filter(d=>d.proposedReject).length,2);
 assert.equal((await screenComments(async()=>{throw new ProviderWait(5000);},run,records,"enforce")).records.length,2);
});

test("provider budget deferral makes no HTTP request",async()=>{
 let calls=0;
 const call=researchCaller({rpc:async()=>({allowed:false,retryAfterMs:9000})},run,{id:"t",kind:"review"},"review",{
  providers:[{provider:"groq",model:"openai/gpt-oss-20b",key:"private",url:"https://example.invalid"}],fetch:async()=>{calls++;}});
 await assert.rejects(()=>call("prompt",100,1000),/provider_wait:9000/);assert.equal(calls,0);
});

test("one routed call logs its provider and honors Retry After without immediate duplicate calls",async()=>{
 const finished:any[]=[];let posts=0;
 const call=researchCaller({rpc:async(name:string,args:any)=>{if(name==="research_provider_acquire")return {allowed:true,provider:"groq",requestId:"request"};finished.push(args);}},run,{id:"t",kind:"review"},"review",{
  providers:[{provider:"groq",model:"openai/gpt-oss-20b",key:"private",url:"https://example.invalid"}],fetch:async()=>{posts++;return new Response("",{status:429,headers:{"retry-after":"75"}});}});
 const result=await call("prompt",100,1000);assert.equal(posts,1);assert.deepEqual(result.errors,["groq:http_429"]);
 assert.equal(finished[0].p_retry_after,75);assert.equal(finished[0].p_status,429);
 assert.equal(retryDelay("Wed, 21 Oct 2026 12:00:10 GMT",Date.parse("2026-10-21T12:00:00Z")),10);
});

test("changing product form or parent context invalidates comment reuse",async()=>{
 const r=record("a");
 assert.notEqual(await decisionHash(run,r),await decisionHash({...run,identity:{...run.identity,name:"Example Lotion"}},r));
 assert.notEqual(await decisionHash(run,r),await decisionHash(run,{...r,contextText:"Was this the lotion?"}));
});


test("shadow screening cannot hold primary comment assessment open",async()=>{
 const prior=(globalThis as any).Deno;(globalThis as any).Deno={env:{get:(name:string)=>name==="RESEARCH_PROVIDER_MODE"?"shared":undefined}};
 const store=memory();let release:any;
 const waiting=new Promise(resolve=>{release=resolve;});
 const out=await assessComments(store,run,{id:"shadow-task",lease:"l",task_key:"shadow",kind:"review",attempts:1,batch:1,payload:{records:[record("a")]}},
  async()=>({data:{decisions:[rejected("a")]},model:"mock",errors:[]}),async()=>waiting);
 assert.equal(out.result.assessed,1);assert.equal(out.result.screening.background,true);
 release({data:{items:[]}});
 (globalThis as any).Deno=prior;
});
test("Groq verification and identity require their supported strict output schema",()=>{
 const format:any=responseFormat("groq","openai/gpt-oss-20b","verify");
 assert.equal(format.json_schema.strict,true);
 assert.deepEqual(format.json_schema.schema.required,["keep"]);
 assert.equal(responseFormat("nvidia","nemotron","verify").type,"json_object");
 assert.equal(responseFormat("groq","openai/gpt-oss-20b","review").type,"json_object");
});


test("SiliconFlow-only routing never selects Groq, NVIDIA or Cloudflare",()=>{
 const all=[{provider:"siliconflow"},{provider:"groq"},{provider:"nvidia"},{provider:"cloudflare"}];
 for(const stage of ["review","verify","identity","facts"])assert.deepEqual(providerCandidates(all,stage,"siliconflow"),[{provider:"siliconflow"}]);
 assert.deepEqual(providerCandidates(all,"filter","siliconflow"),[]);
 assert.deepEqual(providerCandidates(all.slice(1),"review","siliconflow"),[]);
 assert.throws(()=>providerCandidates(all,"review","bad_mode"),/mode_invalid/);
});
test("SiliconFlow uses its own endpoint and does not forward incompatible provider parameters",async()=>{
 let sent:any;let candidates:any;
 const call=researchCaller({rpc:async(name:string,args:any)=>{if(name==="research_provider_acquire"){candidates=args.p_candidates;return {allowed:true,provider:"siliconflow",requestId:"r"};}return null;}},run,{id:"t",kind:"review"},"review",{
  mode:"siliconflow",providers:[{provider:"siliconflow",model:"Qwen/Qwen3-30B-A3B-Instruct-2507",key:"test-key",url:"https://api.siliconflow.com/v1/chat/completions"},{provider:"groq",model:"other",key:"unused",url:"unused"}],
  fetch:async(url:string,init:any)=>{sent={url,body:JSON.parse(init.body)};return new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'},finish_reason:"stop"}],usage:{total_tokens:20}}),{status:200});}});
 assert.equal((await call("Return JSON",100,1000)).data.ok,true);
 assert.equal(sent.url,"https://api.siliconflow.com/v1/chat/completions");assert.equal(candidates.length,1);
 assert.equal(sent.body.reasoning_effort,undefined);assert.equal(sent.body.chat_template_kwargs,undefined);assert.equal(sent.body.response_format.type,"json_object");
});

 test("Modal mode isolates inference from all external providers",()=>{
 const all=[{provider:"modal"},{provider:"siliconflow"},{provider:"groq"},{provider:"nvidia"},{provider:"cloudflare"}];
 for(const stage of ["review","verify","identity","facts"])assert.deepEqual(providerCandidates(all,stage,"modal"),[{provider:"modal"}]);
 assert.deepEqual(providerCandidates(all,"filter","modal"),[]);
 assert.deepEqual(providerCandidates(all.slice(1),"review","modal"),[]);
 assert.deepEqual(providerCandidates(all,"review","shared"),[{provider:"groq"},{provider:"nvidia"}]);
 });
