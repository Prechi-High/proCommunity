/** Preserve the existing presentation builder; persist its ordered writes in one transaction. */
export async function atomicBlueprintWrites(store,task,build){
 const ops=[],effects=[];
 const buffer={
  afterCommit:effect=>effects.push(effect),
  upsert:async(table,row)=>{ops.push({kind:'upsert',table,rows:[row]});},
  upsertMany:async(table,rows)=>{if(rows.length)ops.push({kind:'upsert',table,rows});},
  insertMany:async(table,rows)=>{if(rows.length)ops.push({kind:'insert',table,rows});},
  remove:async(table,filter)=>{ops.push({kind:'remove',table,filter:decodeURIComponent(filter)});},
  patch:async(table,filter,row)=>{ops.push({kind:'patch',table,filter:decodeURIComponent(filter),row});}
 };
 const value=await build(buffer);
 const ok=await store.rpc('research_blueprint_batch',{p_task:task.id,p_lease:task.lease,p_ops:ops});
 if(!ok)throw Error('publication_lease_lost');
 await Promise.all(effects.map(effect=>effect()));
 return value;
}
