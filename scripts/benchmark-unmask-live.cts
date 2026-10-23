/** Actual public API flow; checks complete research rather than treating a preview as success. */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
async function main(){
 const [productId,name,brand,output]=process.argv.slice(2);
 if(!output)throw Error('Usage: productId name brand output.json');
 const endpoint=process.env.UNMASK_BENCHMARK_ENDPOINT||'https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/product-intelligence';
 const started=performance.now(),requestStartedAt=new Date().toISOString(),polls:any[]=[];
 async function call(body:any){const began=performance.now();const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const data=await r.json();if(!r.ok||data.error)throw Error(String(data.error||r.status));return {data,ms:Math.round(performance.now()-began)};}
 const initial=await call({action:'investigate',productId,query:name,name,brand,force:true});
 console.log(JSON.stringify({event:'investigate_response',ms:initial.ms}));
 let terminal=false;
 while(performance.now()-started<180000){
  const result=await call({action:'unmask_status',productId}),progress=result.data.job?.progress;
  polls.push({ms:Math.round(performance.now()-started),requestMs:result.ms,state:progress?.state,milestones:progress?.milestones});
  console.log(JSON.stringify({event:'status',...polls.at(-1)}));
  if(['ready','failed'].includes(progress?.state)){terminal=true;break;}
  await new Promise(resolve=>setTimeout(resolve,2500));
 }
 const readyObservedMs=Math.round(performance.now()-started),report=await call({action:'get',productId});const p=report.data.profile;
 const result={productId,name,requestStartedAt,initialResponseMs:initial.ms,readyObservedMs,reportReadMs:report.ms,visibleTotalMs:Math.round(performance.now()-started),terminal,researchStatus:p?.researchStatus,phase:p?.parallelResearch?.phase,complete:p?.parallelResearch?.phase==='complete'&&p?.researchStatus==='complete',acceptedReports:p?.semanticReview?.rows?.length,diagnostics:p?.youtubeAcquisitionDiagnostics,coverage:p?.parallelResearch?.counts,providerUsage:p?.parallelResearch?.providerUsage,timings:p?.parallelResearch?.timings,videoTimings:p?.parallelResearch?.videoTimings,polls};
 writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify({event:'done',productId,complete:result.complete,visibleTotalMs:result.visibleTotalMs,acceptedReports:result.acceptedReports,diagnostics:result.diagnostics}));
 if(!result.complete||result.visibleTotalMs>60000)process.exitCode=2;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
