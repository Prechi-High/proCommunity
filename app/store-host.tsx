import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Product = { id:string; unmask_product_id?:string|null; title:string; description?:string; price:number; compare_at_price?:number|null; currency:string; inventory_quantity:number; in_stock:boolean; product_url_slug:string; hero_image_url?:string|null };
type Store = { id:string; name:string; slug:string; tagline:string; description:string; logo_url?:string|null; cover_image_url?:string|null; currency:string };

function targetHost() {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  const base = (process.env.EXPO_PUBLIC_STORE_BASE_DOMAIN || 'unmask.app').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const suffix = '.' + base;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return slug && !slug.includes('.') ? { host, slug } : null;
}
function money(value:number,currency:string){ return new Intl.NumberFormat('en-NG',{style:'currency',currency}).format(Number(value||0)); }

export default function StoreHost(){
  const target=targetHost(); const [store,setStore]=useState<Store|null>(null); const [products,setProducts]=useState<Product[]>([]); const [loading,setLoading]=useState(Boolean(target)); const [error,setError]=useState('');
  useEffect(()=>{ if(!target)return; fetch('/api/stores/public-by-host?host='+encodeURIComponent(target.host)).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||'Store unavailable');return p}).then(p=>{setStore(p.store);setProducts(p.products||[])}).catch(e=>setError(e.message||'Store unavailable')).finally(()=>setLoading(false)); },[target?.host]);
  if(!target)return null;
  if(loading)return <View style={styles.center}><ActivityIndicator size="large"/><Text style={styles.muted}>Opening store…</Text></View>;
  if(error||!store)return <View style={styles.center}><Text style={styles.kicker}>UNMASK STORE</Text><Text style={styles.title}>This store is not available.</Text><Text style={styles.muted}>{error||'The store may not be active yet.'}</Text></View>;
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={[styles.hero, store.cover_image_url ? { backgroundColor:'#23231f' } : null]}>
      {store.cover_image_url ? <img src={store.cover_image_url} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:.68}}/> : null}
      <View style={styles.heroShade}/>
      <View style={styles.heroContent}><Text style={styles.kicker}>UNMASK COMMERCE</Text><Text style={styles.heroTitle}>{store.name}</Text>{!!store.tagline&&<Text style={styles.heroTagline}>{store.tagline}</Text>}<Text style={styles.heroBody}>{store.description}</Text><View style={styles.pill}><Text style={styles.pillText}>Intelligence first. Shopping second.</Text></View></View>
    </View>
    <View style={styles.intro}><Text style={styles.sectionKicker}>THE EDIT</Text><Text style={styles.sectionTitle}>Products worth knowing about.</Text><Text style={styles.muted}>Every product can connect back to its Unmask intelligence profile, so customers can investigate before they buy.</Text></View>
    <View style={styles.grid}>{products.map((product,index)=><Pressable key={product.id} onPress={()=>product.unmask_product_id&&Linking.openURL('/product/'+product.unmask_product_id)} style={[styles.product,index%3===0?styles.productWide:null]}>
      <View style={styles.imageFrame}>{product.hero_image_url?<img src={product.hero_image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<View style={styles.imageFallback}><Text style={styles.fallbackText}>UNMASK</Text></View>}<View style={styles.productBadge}><Text style={styles.productBadgeText}>{product.in_stock?'IN STOCK':'SOLD OUT'}</Text></View></View>
      <View style={styles.productInfo}><Text style={styles.productTitle}>{product.title}</Text><Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text><Text style={styles.price}>{money(product.price,product.currency||store.currency)}</Text></View>
    </Pressable>)}</View>
    <View style={styles.footer}><Text style={styles.footerBrand}>UNMASK</Text><Text style={styles.muted}>Know before you buy.</Text></View>
  </ScrollView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f7f5ef'},content:{paddingBottom:80},center:{flex:1,minHeight:'100%',alignItems:'center',justifyContent:'center',padding:40,backgroundColor:'#f7f5ef'},muted:{color:'#5d5b55',fontSize:16,lineHeight:25},kicker:{fontSize:11,letterSpacing:2.5,fontWeight:'800',marginBottom:14},title:{fontSize:42,fontWeight:'800',letterSpacing:-1.5,marginBottom:12},hero:{minHeight:620,position:'relative',backgroundColor:'#1d1d1b',overflow:'hidden'},heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.36)'},heroContent:{maxWidth:1180,width:'100%',alignSelf:'center',padding:48,paddingTop:120,minHeight:620,justifyContent:'flex-end'},heroTitle:{color:'#fff',fontSize:72,lineHeight:76,fontWeight:'800',letterSpacing:-3},heroTagline:{color:'#fff',fontSize:22,marginTop:14,maxWidth:620},heroBody:{color:'rgba(255,255,255,.76)',fontSize:16,lineHeight:25,marginTop:14,maxWidth:640},pill:{alignSelf:'flex-start',marginTop:22,borderWidth:1,borderColor:'rgba(255,255,255,.35)',borderRadius:999,paddingHorizontal:15,paddingVertical:9},pillText:{color:'#fff',fontSize:12,fontWeight:'700'},intro:{maxWidth:1180,width:'100%',alignSelf:'center',padding:48,paddingTop:90},sectionKicker:{fontSize:11,letterSpacing:2.5,fontWeight:'800',marginBottom:12},sectionTitle:{fontSize:48,lineHeight:52,fontWeight:'800',letterSpacing:-2,marginBottom:14,maxWidth:760},grid:{maxWidth:1180,width:'100%',alignSelf:'center',paddingHorizontal:48,flexDirection:'row',flexWrap:'wrap',gap:22},product:{width:'31.8%',minWidth:260},productWide:{width:'65.8%'},imageFrame:{height:380,backgroundColor:'#e8e5dc',borderRadius:24,overflow:'hidden',position:'relative'},productBadge:{position:'absolute',left:14,top:14,borderRadius:999,paddingHorizontal:10,paddingVertical:6,backgroundColor:'rgba(255,255,255,.9)'},productBadgeText:{fontSize:10,fontWeight:'800',letterSpacing:1},imageFallback:{flex:1,alignItems:'center',justifyContent:'center'},fallbackText:{fontSize:18,letterSpacing:4,fontWeight:'800',opacity:.3},productInfo:{padding:16,paddingBottom:32},productTitle:{fontSize:21,fontWeight:'800',marginBottom:6},productDesc:{color:'#6b6860',lineHeight:21,minHeight:42},price:{fontSize:17,fontWeight:'800',marginTop:12},footer:{maxWidth:1180,width:'100%',alignSelf:'center',padding:48,paddingTop:100},footerBrand:{fontSize:34,fontWeight:'900',letterSpacing:4,marginBottom:8}});
