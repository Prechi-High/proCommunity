import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, Skeleton } from "@/components/unmask-ui";
import { ChatCircleDots, UsersThree } from "@/components/icons";
import { db } from "@/lib/clarity/api";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";

type Session={id:string;title:string;description:string;status:string;scheduled_at:string|null;host_creator_id:string|null;metadata:any};

export default function Room(){
 const router=useRouter();const[rows,setRows]=useState<Session[]>([]);const[loading,setLoading]=useState(true);const uid=useAppStore(s=>s.profile?.id);

 useEffect(()=>{
   let active=true;
   const load=async()=>{
     try{
       const {data}=await db()
         .from("unmask_realtime_sessions")
         .select("id,title,description,status,scheduled_at,host_creator_id,metadata")
         .eq("mode","room")
         .in("status",["scheduled","live"])
         .order("scheduled_at",{ascending:true})
         .limit(20);
       if(active)setRows((data??[]) as Session[]);
     }catch{
       // Keep the empty state when the realtime session feed is unavailable.
     }finally{
       if(active)setLoading(false);
     }
   };
   void load();
   return()=>{active=false};
 },[]);

 return <AppShell back title="Room" subtitle="Talk it through together."><View style={{gap:16}}>
  <View style={{padding:22,borderRadius:26,backgroundColor:"#F3EBE2",gap:11}}><ChatCircleDots size={29} color={colors.brandDeep} weight="fill"/><Text style={{fontFamily:fonts.semibold,fontSize:27,lineHeight:32,color:colors.ink}}>Audio-first product conversations.</Text><Text style={{fontFamily:fonts.regular,fontSize:15,lineHeight:23,color:colors.inkSoft}}>Listen to a moderated discussion, request the mic when invited, and add your experience to the collective picture.</Text></View>
  {loading?<Skeleton height={150}/>:rows.length?rows.map(s=>{
   const isHost=!!uid&&s.host_creator_id===uid; const count=Number(s.metadata?.participant_count||0); const talking=Number(s.metadata?.active_speaker_count||0)>0;
   return <View key={s.id} style={{padding:18,borderRadius:23,backgroundColor:"#fff",borderWidth:1,borderColor:"#EDE6E1",gap:9}}><Text style={{fontFamily:fonts.semibold,fontSize:12,color:s.status==="live"?"#B42318":colors.inkSoft,letterSpacing:.8}}>{isHost?"YOUR ROOM":s.status==="live"?"LIVE ROOM":"SCHEDULED ROOM"}</Text><Text style={{fontFamily:fonts.semibold,fontSize:20,color:colors.ink}}>{s.title}</Text><Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:colors.inkSoft}}>{s.description}</Text>{s.status==="live"?<View style={{flexDirection:"row",alignItems:"center",gap:8}}><UsersThree size={15} color={colors.inkSoft}/><Text style={{fontFamily:fonts.medium,fontSize:12,color:colors.inkSoft}}>{count} {count===1?"person":"people"} here</Text><Text style={{fontFamily:fonts.medium,fontSize:12,color:talking?colors.brandDeep:colors.inkSoft}}>{talking?"· People are talking":"· Waiting"}</Text></View>:null}<ActionButton label={isHost?"Resume hosting":s.status==="live"?"Join Room":"View room"} onPress={()=>router.push({pathname:"/room/session",params:{id:s.id,...(isHost?{host:"1"}:{})}} as Href)}/></View>;
 }):<View style={{padding:20,borderRadius:23,backgroundColor:"#F6F3F1",gap:10}}><ChatCircleDots size={25} color={colors.brandDeep}/><Text style={{fontFamily:fonts.semibold,fontSize:19,color:colors.ink}}>No Rooms yet.</Text><Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:colors.inkSoft}}>Rooms will appear as creators schedule audio discussions.</Text><ActionButton tone="secondary" label="Meet the creators" onPress={()=>router.push("/creators" as Href)}/></View>}
  <View style={{flexDirection:"row",alignItems:"center",gap:10,paddingTop:5}}><UsersThree size={19} color={colors.inkSoft}/><Text style={{flex:1,fontFamily:fonts.regular,fontSize:13,lineHeight:19,color:colors.inkSoft}}>Rooms are community spaces. Ultra is the structured path when one person's situation needs deeper investigation.</Text></View>
  <ActionButton tone="secondary" label="See Live" onPress={()=>router.push("/live" as Href)}/>
 </View></AppShell>;
}
