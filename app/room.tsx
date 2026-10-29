import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, Skeleton } from "@/components/unmask-ui";
import { ChatCircleDots, Microphone, UsersThree } from "@/components/icons";
import { db } from "@/lib/clarity/api";
import { colors, fonts } from "@/constants/theme";
type Session={id:string;title:string;description:string;status:string;scheduled_at:string|null};
export default function Room(){
 const router=useRouter();const[rows,setRows]=useState<Session[]>([]);const[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;db().from("unmask_realtime_sessions").select("id,title,description,status,scheduled_at").eq("mode","room").in("status",["scheduled","live"]).order("scheduled_at",{ascending:true}).limit(20).then(({data})=>{if(active){setRows((data??[]) as Session[]);setLoading(false)}}).catch(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <AppShell back title="Room" subtitle="Talk it through together."><View style={{gap:16}}>
  <View style={{padding:22,borderRadius:26,backgroundColor:"#F3EBE2",gap:11}}><ChatCircleDots size={29} color={colors.brandDeep} weight="fill"/><Text style={{fontFamily:fonts.semibold,fontSize:27,lineHeight:32,color:colors.ink}}>Audio-first product conversations.</Text><Text style={{fontFamily:fonts.regular,fontSize:15,lineHeight:23,color:colors.inkSoft}}>Listen to a moderated discussion, request the mic when invited, and add your experience to the collective picture.</Text></View>
  {loading?<Skeleton height={150}/>:rows.length?rows.map(s=><View key={s.id} style={{padding:18,borderRadius:23,backgroundColor:"#fff",borderWidth:1,borderColor:"#EDE6E1",gap:9}}><Text style={{fontFamily:fonts.semibold,fontSize:12,color:colors.inkSoft,letterSpacing:.8}}>{s.status==="live"?"LIVE ROOM":"SCHEDULED ROOM"}</Text><Text style={{fontFamily:fonts.semibold,fontSize:20,color:colors.ink}}>{s.title}</Text><Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:colors.inkSoft}}>{s.description}</Text><ActionButton label={s.status==="live"?"Join Room":"View room"} onPress={()=>router.push({pathname:"/room/session",params:{id:s.id}} as Href)}/></View>):<View style={{padding:20,borderRadius:23,backgroundColor:"#F6F3F1",gap:10}}><Microphone size={25} color={colors.brandDeep}/><Text style={{fontFamily:fonts.semibold,fontSize:19,color:colors.ink}}>No Rooms yet.</Text><Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:colors.inkSoft}}>Rooms will become the audio discussion layer as the first creator roster comes online.</Text><ActionButton tone="secondary" label="Meet the creators" onPress={()=>router.push("/creators" as Href)}/></View>}
  <View style={{flexDirection:"row",alignItems:"center",gap:10,paddingTop:5}}><UsersThree size={19} color={colors.inkSoft}/><Text style={{flex:1,fontFamily:fonts.regular,fontSize:13,lineHeight:19,color:colors.inkSoft}}>Rooms are community spaces. Ultra is the structured path when one person's situation needs deeper investigation.</Text></View>
 </View></AppShell>;
}