import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, Skeleton } from "@/components/unmask-ui";
import { Play, UsersThree, BellRinging, ChatCircleDots } from "@/components/icons";
import { db } from "@/lib/clarity/api";
import { colors, fonts } from "@/constants/theme";

type Session = { id:string; title:string; description:string; status:string; scheduled_at:string|null };

export default function Live() {
  const router=useRouter();
  const [rows,setRows]=useState<Session[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;db().from("unmask_realtime_sessions").select("id,title,description,status,scheduled_at").eq("mode","live").in("status",["scheduled","live"]).order("scheduled_at",{ascending:true}).limit(20).then(({data})=>{if(active){setRows((data??[]) as Session[]);setLoading(false)}}).catch(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  return <AppShell back title="Live" subtitle="Discovery, in real time."><View style={{gap:16}}>
    <View style={{padding:22,borderRadius:26,backgroundColor:"#2A0E16",gap:11}}>
      <Play size={28} color="#F2D25B" weight="fill"/>
      <Text style={{fontFamily:fonts.semibold,fontSize:27,lineHeight:32,color:"#fff"}}>See what creators are finding right now.</Text>
      <Text style={{fontFamily:fonts.regular,fontSize:15,lineHeight:23,color:"#E9D8E0"}}>Lives are open discovery. Ask questions, watch the investigation unfold, and move to Ultra when a situation needs deeper context.</Text>
    </View>
    {loading?<Skeleton height={150}/>:rows.length?rows.map(s=><View key={s.id} style={{padding:18,borderRadius:23,backgroundColor:"#fff",borderWidth:1,borderColor:"#EDE6E1",gap:9}}>
      <Text style={{fontFamily:fonts.semibold,fontSize:12,color:s.status==="live"?"#B42318":colors.inkSoft,letterSpacing:.8}}>{s.status==="live"?"LIVE NOW":"UP NEXT"}</Text>
      <Text style={{fontFamily:fonts.semibold,fontSize:20,color:colors.ink}}>{s.title}</Text>
      <Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:colors.inkSoft}}>{s.description}</Text>
      <ActionButton label={s.status==="live"?"Join Live":"View session"} onPress={()=>router.push({pathname:"/live/session",params:{id:s.id}} as Href)}/>
    </View>):<View style={{padding:20,borderRadius:23,backgroundColor:"#F6F3F1",gap:10}}>
      <BellRinging size={25} color={colors.brandDeep}/>
      <Text style={{fontFamily:fonts.semibold,fontSize:19,color:colors.ink}}>No Live sessions yet.</Text>
      <Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:colors.inkSoft}}>The creator roster is being built. Scheduled sessions will appear here automatically.</Text>
      <ActionButton tone="secondary" label="Explore Ultra" onPress={()=>router.push("/ultra-unmask" as Href)}/>
    </View>}
    <View style={{flexDirection:"row",alignItems:"center",gap:10,paddingTop:5}}><UsersThree size={19} color={colors.inkSoft}/><Text style={{flex:1,fontFamily:fonts.regular,fontSize:13,lineHeight:19,color:colors.inkSoft}}>Live is free-flowing discovery. When one person's situation needs deeper context, Ultra is the structured path.</Text></View>
    <Pressable onPress={()=>router.push("/room" as Href)} style={{padding:17,borderRadius:20,borderWidth:1,borderColor:"#EDE6E1",backgroundColor:"#fff",flexDirection:"row",gap:12,alignItems:"center"}}>
      <ChatCircleDots size={22} color={colors.brandDeep}/><View style={{flex:1}}><Text style={{fontFamily:fonts.semibold,fontSize:16,color:colors.ink}}>Prefer audio?</Text><Text style={{fontFamily:fonts.regular,fontSize:13,color:colors.inkSoft}}>Open Rooms for creator-led discussions.</Text></View>
    </Pressable>
  </View></AppShell>;
}
