import { researchStore } from "./store.js";
import { RESEARCH_VERSION, assessmentTasks } from "./logic.js";
import { loadCommunityEvidence } from "../evidence/communityEvidence.ts";
import { reviewRecords } from "../evidence/semanticReview.ts";
import { getOrBuildBlueprintPackage } from "../blueprint/getOrBuild.ts";
import { redisService } from "../redis/service.ts";
import { productPreviewKey } from "../redis/keys.ts";
import { cleanSelectedProductName } from "../investigation/selectedIdentity.ts";
import { writeUnmaskJob, progressForState } from "../investigation/jobStore.ts";

export async function startParallelResearch(input) {
 const store=researchStore(), id=input.productId;
 let old=await store.select("research_runs","product_id=eq."+encodeURIComponent(id));
 if(old&&!input.force){
  const hit=await store.select("product_intel","id=eq."+encodeURIComponent(id));
  if(old.phase!=="interrupted"){
   await store.rpc("research_dispatch",{});
   await writeUnmaskJob(id,{progress:{...progressForState(old.phase==="complete"?"ready":"researching",[],old.phase==="complete"?[]:["research"]),
    sections:{details:"ready",evidence:old.phase==="complete"?"ready":"researching",videos:"ready",scores:old.phase==="complete"?"ready":"researching"}}},store);
   return {cached:old.phase==="complete",profile:hit?.payload||old.profile};
  }
 }
 if(old) {
  await store.remove("research_runs","id=eq."+old.id);
 }
 const preview=(await redisService.getJson(productPreviewKey(id))).value;
 const name=cleanSelectedProductName(input.selectedName||preview?.identity?.name||input.query);
 const identity={name,brand:input.selectedBrand||preview?.identity?.brand||"",manufacturer:"",
  model:preview?.identity?.model||"",category:preview?.identity?.category||"Product",
  subcategory:preview?.identity?.subcategory||"",variant:preview?.identity?.variant||"",size:preview?.identity?.size||""};
 const profile={id,query:input.query,version:8,identity,summary:preview?.summary||"Checking product information and experiences.",
  verdict:"",consensus:"",consensusMark:"",voices:[],reveals:[],people:{voices:0,commenters:0,ratings:0,discussions:0},
  specs:preview?.specs||[],praise:[],complaints:[],bestFor:[],notFor:[],uses:[],howToUse:"",compatibility:"",
  alternatives:[],offers:[],priceRange:null,rating:null,ratingCount:null,score:null,confidence:0,band:"Uncertain",
  images:preview?.images||[],gallery:preview?.gallery||[],variants:[],sources:[],verifiedAt:new Date().toISOString(),
  identityConfidence:0.6,semanticReviewRequired:true,researchStatus:"researching",
  parallelResearch:{version:RESEARCH_VERSION,phase:"discovering",batch:1,loadingCategories:[]}};
 const blueprint=await getOrBuildBlueprintPackage(id,input.query,profile);
 profile.preparedBlueprint=blueprint;
 identity.category=blueprint.classification.domain==="beauty"?"Beauty":identity.category;
 // Community is loaded before external discovery. Private experiences never enter this pool.
 profile.communityEvidence=await loadCommunityEvidence(store,id);
 const run=await store.insert("research_runs",{product_id:id,identity,blueprint,profile,
  endpoint:Deno.env.get("SUPABASE_URL")+"/functions/v1/research-worker"});
 await store.upsert("product_intel",{id,query:input.query,name,brand:identity.brand,category:identity.category,
  hero_image_url:profile.images[0]||null,payload:profile,confidence:0,verified_at:new Date().toISOString(),
  refresh_after:new Date(Date.now()+7*86400000).toISOString()});
 const tasks=[{key:"discover",kind:"discover",payload:{}},{key:"facts",kind:"facts",payload:{}},
  ...assessmentTasks(reviewRecords(profile),"community")];
 await store.insertMany("research_tasks",tasks.map(t=>({run_id:run.id,task_key:t.key,kind:t.kind,batch:1,payload:t.payload})));
 await writeUnmaskJob(id,{progress:{...progressForState("researching",[],["youtube","community","details"]),
  sections:{details:"researching",evidence:"researching",videos:"researching",scores:"pending"}}},store);
 await store.rpc("research_dispatch",{});
 return {cached:false,profile};
}
