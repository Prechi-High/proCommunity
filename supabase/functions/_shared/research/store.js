export function researchStore() {
 const base=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!base||!key)throw Error("research_storage_unconfigured");
 const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
 const metrics={requests:0,durationMs:0,failures:0};
 const request=async(path,method="GET",body,extra={})=>{
  const began=Date.now();
  metrics.requests++;
  const r=await fetch(base+"/rest/v1/"+path,{method,headers:{...headers,...extra},
   body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  metrics.durationMs+=Date.now()-began;if(!r.ok)metrics.failures++;
  console.info(JSON.stringify({event:"research_storage",operation:path.split("?")[0],method,status:r.status,durationMs:Date.now()-began}));
  if(!r.ok)throw Error("research_storage_"+r.status+":"+ (await r.text()).slice(0,200));
  const text=await r.text();return text?JSON.parse(text):null;
 };
 return {
  metrics,
  rows:async path=>(await request(path))||[],
  select:async(table,filter)=>(await request(table+"?"+filter+"&limit=1"))?.[0]||null,
  upsert:async(table,row)=>request(table,"POST",row,{Prefer:"resolution=merge-duplicates,return=minimal"}),
  upsertOn:async(table,rows,key)=>rows.length?request(table+"?on_conflict="+encodeURIComponent(key),"POST",rows,{Prefer:"resolution=merge-duplicates,return=minimal"}):undefined,
  upsertMany:async(table,rows)=>rows.length?request(table+"?on_conflict=id","POST",rows,{Prefer:"resolution=merge-duplicates,return=minimal"}):undefined,
  insertMany:async(table,rows)=>rows.length?request(table,"POST",rows,{Prefer:"resolution=ignore-duplicates,return=minimal"}):undefined,
  insert:async(table,row)=>(await request(table,"POST",row,{Prefer:"return=representation"}))?.[0],
  patch:async(table,filter,row)=>request(table+"?"+filter,"PATCH",row,{Prefer:"return=minimal"}),
  remove:async(table,filter)=>request(table+"?"+filter,"DELETE",undefined,{Prefer:"return=minimal"}),
  rpc:async(name,args)=>request("rpc/"+name,"POST",args),
  async allTasks(runId) { return (await request("rpc/research_task_snapshot","POST",{p_run:runId}))||[]; }
 };
}
