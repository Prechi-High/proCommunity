import { commerceSupabase, json, requireUser } from '../_lib';

type Req={method?:string;body?:{productId?:string;active?:boolean};headers?:Record<string,string|string[]|undefined>};
type Res={status:(code:number)=>{json:(body:unknown)=>void;send:(body:string)=>void}};

export default async function handler(req:Req,res:Res){
  if((req.method??'GET').toUpperCase()!=='POST'){json(res,405,{error:'method_not_allowed'});return;}
  const user=await requireUser(req); if(!user){json(res,401,{error:'unauthorized'});return;}
  const productId=req.body?.productId?.trim(); if(!productId){json(res,400,{error:'productId_required'});return;}
  const db=commerceSupabase();
  const seller=await db.from('sellers').select('id').eq('core_user_id',user.id).maybeSingle();
  if(seller.error||!seller.data){json(res,404,{error:'seller_not_found'});return;}
  const product=await db.from('store_products').select('id,store_id,title,status,stores!inner(id,seller_id,status)').eq('id',productId).eq('stores.seller_id',seller.data.id).maybeSingle();
  if(product.error||!product.data){json(res,404,{error:'product_not_found'});return;}
  const next=req.body?.active===false?'draft':'active';
  if(product.data.stores?.status!=='active'){json(res,409,{error:'store_not_active'});return;}
  const updated=await db.from('store_products').update({status:next}).eq('id',productId).select('id,title,status').single();
  if(updated.error){json(res,400,{error:'product_update_failed',detail:updated.error.message});return;}
  json(res,200,{ok:true,product:updated.data});
}
