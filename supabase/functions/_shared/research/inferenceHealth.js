/** Distinguish a permanent account refusal from a transient model startup error. */
export async function requireInferenceHealth(response){
 if(response.ok)return;
 const body=(await response.text()).slice(0,1000);
 if(/workspace\b[^\n]*\bis disabled\b/i.test(body)){
  const error=new Error('inference_workspace_disabled');
  error.permanent=true;throw error;
 }
 throw Error('modal_startup_http_'+response.status);
}
