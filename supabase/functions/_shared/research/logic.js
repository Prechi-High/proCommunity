/** Pure scheduling/aggregation rules, shared by live workers and regression tests. */
export const RESEARCH_VERSION = "parallel-two-batch-v1";
export const BATCH_SIZE = 20;
export const MIN_REPORTS = 5;
export const REVIEW_GROUP_SIZE = 8;

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
