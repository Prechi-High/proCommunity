import { providerConfiguration, providerCandidates, researchProviderMode, loadResearchProviderConfig } from "./providers.js";
import { researchStore } from "./store.js";
import { RESEARCH_VERSION, assessmentTasks, identityNeedsConfirmation } from "./logic.js";
import { loadCommunityEvidence } from "../evidence/communityEvidence.ts";
import { reviewRecords } from "../evidence/semanticReview.ts";
import { getOrBuildBlueprintPackage } from "../blueprint/getOrBuild.ts";
import { redisService } from "../redis/service.ts";
import { productPreviewKey } from "../redis/keys.ts";
import { cleanSelectedProductName } from "../investigation/selectedIdentity.ts";
import { writeUnmaskJob, progressForState } from "../investigation/jobStore.ts";

export async function startParallelResearch(input) {
 const store=researchStore(), id=input.productId;
 await loadResearchProviderConfig(store);
 let old=await store.select("research_runs","product_id=eq."+encodeURIComponent(id));
 if(old&&identityNeedsConfirmation(old.identity)&&!input.selectedBrand)throw Error("Please select the exact product, including its brand. The selected name is only a generic product type.");
 if(old&&!input.force){
  const hit=await store.select("product_intel","id=eq."+encodeURIComponent(id));
  {
   await store.rpc("research_dispatch",{});
   await writeUnmaskJob(id,{progress:{...progressForState(["complete","interrupted"].includes(old.phase)?"ready":"researching",[],old.phase==="complete"?[]:["research"]),
    sections:{details:"ready",evidence:["complete","interrupted"].includes(old.phase)?"ready":"researching",videos:"ready",scores:["complete","interrupted"].includes(old.phase)?"ready":"researching"}}},store);
   return {cached:old.phase==="complete",profile:hit?.payload||old.profile};
  }
 }
 if(["siliconflow","modal"].includes(researchProviderMode())&&!providerCandidates(providerConfiguration(),"review").length)throw Error(researchProviderMode()==="modal"?"Modal inference is not configured. Set MODAL_NANO_API_KEY and MODAL_NANO_BASE_URL in Supabase secrets.":"SiliconFlow is not configured. Add SILICONFLOW_API_KEY in Supabase Edge Function secrets.");
 const preview=(await redisService.getJson(productPreviewKey(id))).value;
 const name=cleanSelectedProductName(input.selectedName||preview?.identity?.name||input.query);
 const identity={name,brand:input.selectedBrand||preview?.identity?.brand||"",manufacturer:"",
  model:preview?.identity?.model||"",category:preview?.identity?.category||"Product",
  subcategory:preview?.identity?.subcategory||"",variant:preview?.identity?.variant||"",size:preview?.identity?.size||""};
 if(identityNeedsConfirmation(identity))throw Error("Please select the exact product, including its brand. The selected name is only a generic product type.");
 const profile={id,query:input.query,version:9,identity,summary:preview?.summary||"Checking product information and experiences.",
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
 const tasks=[{key:"discover",kind:"discover",payload:{}},{key:"facts",kind:"facts",payload:{}},
  ...assessmentTasks(reviewRecords(profile),"community")];
 const opened=await store.rpc("research_open",{p_product:id,p_identity:identity,p_blueprint:blueprint,p_profile:profile,
  p_endpoint:Deno.env.get("SUPABASE_URL")+"/functions/v1/research-worker",p_force:!!input.force,p_tasks:tasks});
 const run=opened.run;
 if(!opened.created){
  await store.rpc("research_dispatch",{});
  const hit=await store.select("product_intel","id=eq."+encodeURIComponent(id));
  return {cached:run.phase==="complete",profile:hit?.payload||run.profile};
 }
 await store.upsert("product_intel",{id,query:input.query,name,brand:identity.brand,category:identity.category,
  hero_image_url:profile.images[0]||null,payload:profile,confidence:0,verified_at:new Date().toISOString(),
  refresh_after:new Date(Date.now()+7*86400000).toISOString()});
 await writeUnmaskJob(id,{progress:{...progressForState("researching",[],["youtube","community","details"]),
  sections:{details:"researching",evidence:"researching",videos:"researching",scores:"pending"}}},store);
 await store.rpc("research_dispatch",{});
 return {cached:false,profile};
}
