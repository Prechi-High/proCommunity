/** Pure scheduling/aggregation rules, shared by live workers and regression tests. */
export const RESEARCH_VERSION = "parallel-two-batch-v1";
export const BATCH_SIZE = 20;
export const MIN_REPORTS = 5;
export const REVIEW_GROUP_SIZE = 8;

/** Opaque YouTube cursors can exceed PostgreSQL's indexed-key size. Keep them in payload only. */
export async function commentPageTaskKey(videoId, stream, parentId, token) {
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 const key=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,"0")).join("");
 return "collect:"+videoId+":"+stream+":"+(parentId||"")+":"+key;
}

export function assessmentTasks(records, prefix, batch=1) {
 const tasks=[];
 for(let i=0;i<records.length;i+=REVIEW_GROUP_SIZE) tasks.push({
  key:prefix+":"+i,kind:"review",batch,payload:{records:records.slice(i,i+REVIEW_GROUP_SIZE)}
 });
 return tasks;
}
export function coverage(rows,dimensions) {
 const result={};
 for(const d of dimensions) {
  const seen=new Set();
  for(const row of rows) for(const link of row.dimensionLinks||[]) {
   if(link.dimensionKey===d.key && link.affectsScore && row.productMatch?.affectsScore)
    seen.add(row.reportKey||row.evidenceId);
  }
  result[d.key]=seen.size;
 }
 return result;
}
export function weakCategories(rows,dimensions) {
 const counts=coverage(rows,dimensions);
 return dimensions.filter(d=>counts[d.key]<MIN_REPORTS).map(d=>d.key);
}
export function chooseNextVideos(videos,used,weak) {
 const excluded=new Set(used);
 return videos.filter(v=>!excluded.has(v.id)).sort((a,b)=>
  (b.matchedQueryTopics||[]).filter(x=>weak.includes(x)).length -
  (a.matchedQueryTopics||[]).filter(x=>weak.includes(x)).length
 ).slice(0,BATCH_SIZE);
}
export function combineDecisions(results) {
 const decisions={};
 for(const result of results) for(const [id,d] of Object.entries(result.decisions||{})) decisions[id]=d;
 const seenText=new Set();
 const rows=Object.values(decisions).flatMap(d=>{
  if(!d.row) return [];
  const fingerprint=d.row.text.toLowerCase().replace(/\s+/g," ").trim();
  if(seenText.has(fingerprint))return [];
  seenText.add(fingerprint); return [d.row];
 });
 return {decisions,rows};
}
export function researchSummary(rows,dimensions) {
 const counts=coverage(rows,dimensions);
 return Object.fromEntries(dimensions.map(d=>{
  const seen=new Set(), items=[];
  for(const row of rows) for(const l of row.dimensionLinks||[]) {
   const key=row.reportKey||row.evidenceId;
   if(l.dimensionKey!==d.key||!l.affectsScore||!row.productMatch?.affectsScore||seen.has(key))continue;
   seen.add(key);items.push(l);
  }
  const positive=items.filter(x=>x.stance==="positive").length;
  const negative=items.filter(x=>x.stance==="negative").length;
  const mixed=items.filter(x=>x.stance==="mixed").length;
  return [d.key,{acceptedReports:counts[d.key],positive,negative,mixed,
   positiveShare:items.length?Math.round(100*positive/items.length):null,
   limited:items.length<MIN_REPORTS}];
 }));
}
export function normalizeThreads(data,video) {
 const records=[],replyJobs=[];
 for(const thread of data.items||[]) {
  const top=thread.snippet?.topLevelComment, sn=top?.snippet;
  if(!top?.id||!sn)continue;
  const parent=String(sn.textOriginal||sn.textDisplay||"");
  const add=(comment,context,parentId)=>{
   const s=comment.snippet||{},text=String(s.textOriginal||s.textDisplay||"").trim();
   if(!text)return;
   records.push({id:"youtube:"+comment.id,sourceId:comment.id,platform:"youtube",provider:"youtube",
    text,title:video.title,author:String(s.authorDisplayName||"").replace(/^@/,""),
    authorId:s.authorChannelId?.value||"",conversationId:video.id,parentId,contextText:context,
    createdAt:s.publishedAt,url:"https://www.youtube.com/watch?v="+video.id+"&lc="+comment.id});
  };
  add(top,undefined,undefined);
  for(const reply of thread.replies?.comments||[])add(reply,parent,top.id);
  if((thread.snippet?.totalReplyCount||0)>(thread.replies?.comments?.length||0))
   replyJobs.push({parentId:top.id,parentText:parent});
 }
 return {records,replyJobs};
}
export function logicSelfTest() {
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 const dims=[{key:"absorption"},{key:"irritation"}];
 const row=(i)=>({evidenceId:String(i),reportKey:"author:"+i,text:"report "+i,productMatch:{affectsScore:true},
 dimensionLinks:[{dimensionKey:"absorption",affectsScore:true,stance:"positive"}]});
 const rows=Array.from({length:100},(_,i)=>row(i));
 assert(coverage(rows,dims).absorption===100,"no five-report cap");
 assert(weakCategories(rows,dims).join()==="irritation","only deficient category expands");
 assert(coverage([row(1),row(1)],dims).absorption===1,"distinct reporters");
 const videos=Array.from({length:60},(_,i)=>({id:String(i),matchedQueryTopics:i>30?["irritation"]:[]}));
 assert(chooseNextVideos(videos,[],[]).length===20,"twenty videos");
 assert(!chooseNextVideos(videos,["31"],["irritation"]).some(v=>v.id==="31"),"no repeated video");
 assert(chooseNextVideos(videos,[],["irritation"])[0].id==="31","gap priority");
 assert(assessmentTasks(Array.from({length:100}),"page").reduce((n,t)=>n+t.payload.records.length,0)===100,"no dropped comments");
 const summary=researchSummary([row(1),{...row(2),dimensionLinks:[{dimensionKey:"absorption",affectsScore:true,stance:"negative"}]}],dims);
 assert(summary.absorption.positiveShare===50,"deterministic score");
 const merged=combineDecisions([{decisions:{a:{row:row(1)}}},{decisions:{a:{row:row(1)},b:{row:row(2)}}}]);
 assert(merged.rows.length===2,"idempotent merge");
 return {passed:9};
}

/** A generic product type is not an exact identity. Never guess a brand. */
export function identityNeedsConfirmation(identity) {
 if(identity.brand?.trim()||identity.model?.trim())return false;
 const words=String(identity.name||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(/\s+/);
 const generic=new Set("travel size sized mini small medium large body face facial hand foot skin butter cream lotion oil cleanser wash soap moisturizer moisturising moisturizing hydrating hydration brightening nourishing natural organic whipped rich shea cocoa coconut unscented fragrance free product gel serum shampoo conditioner deodorant sunscreen phone charger cable headphones laptop review pack oz ml g the a and for".split(" "));
 return !words.some(w=>w&&!generic.has(w)&&!/^\d+$/.test(w));
}
export function discoveryName(identity){
 const name=identity.name.trim(),brand=identity.brand?.trim();
 return brand&&!name.toLowerCase().includes(brand.toLowerCase())?brand+" "+name:name;
}
export function rankedCandidates(videos,identity){
 const words=discoveryName(identity).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);
 const score=v=>words.reduce((n,w)=>n+(v.title||"").toLowerCase().includes(w),0)+(v.commentCount>0?.1:0);
 return [...videos].sort((a,b)=>score(b)-score(a));
}
export function stageTimings(tasks,start,now=Date.now()){
 const stages={};
 for(const t of tasks){
  const s=stages[t.kind]||{tasks:0,done:0,failed:0,pending:0,processingMs:0,queueMs:0,deferrals:0,firstStartedMs:null,lastFinishedMs:null};
  s.tasks++;s[t.state==="done"?"done":t.state==="failed"?"failed":"pending"]++;
  s.processingMs+=Number(t.total_processing_ms||t.result?.durationMs||0);
  s.deferrals+=Number(t.capacity_deferrals||0);
  if(t.first_started_at){const first=Date.parse(t.first_started_at);s.queueMs+=Math.max(0,first-Date.parse(t.created_at));s.firstStartedMs=Math.min(s.firstStartedMs??Infinity,first-Date.parse(start));}
  if(t.finished_at)s.lastFinishedMs=Math.max(s.lastFinishedMs??0,Date.parse(t.finished_at)-Date.parse(start));
  stages[t.kind]=s;
 }
 return {elapsedMs:now-Date.parse(start),stages};
}
