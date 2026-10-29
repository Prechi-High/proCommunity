import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, Skeleton } from "@/components/unmask-ui";
import { Play, UsersThree, BellRinging, ChatCircleDots } from "@/components/icons";
import { db } from "@/lib/clarity/api";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";

type Session = { id:string; title:string; description:string; status:string; scheduled_at:string|null; host_creator_id:string|null; metadata:any };

export default function Live() {
  const router=useRouter();
  const [rows,setRows]=useState<Session[]>([]);
  const uid = useAppStore(s => s.profile?.id);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const {data}=await db()
          .from("unmask_realtime_sessions")
          .select("id,title,description,status,scheduled_at,host_creator_id,metadata")
          .eq("mode","live")
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

  return <AppShell back title="Live" subtitle="Discovery, in real time."><View style={{gap:16}}>
    <View style={{padding:22,borderRadius:26,backgroundColor:"#2A0E16",gap:11}}>
      <Play size={28} color="#F2D25B" weight="fill"/>
      <Text style={{fontFamily:fonts.semibold,fontSize:27,lineHeight:32,color:"#fff"}}>See what creators are finding right now.</Text>
      <Text style={{fontFamily:fonts.regular,fontSize:15,lineHeight:23,color:"#E9D8E0"}}>Lives are open discovery. Ask questions, watch the investigation unfold, and move to Ultra when a situation needs deeper context.</Text>
    </View>
    {loading?<Skeleton height={150}/>:rows.length?rows.map(s=>{
      const isHost = !!uid && s.host_creator_id === uid;
      const count = Number(s.metadata?.participant_count || 0);
      const talking = Number(s.metadata?.active_speaker_count || 0) > 0;
      return <View key={s.id} style={{padding:18,borderRadius:23,backgroundColor:"#fff",borderWidth:1,borderColor:"#EDE6E1",gap:9}}>
      <Text style={{fontFamily:fonts.semibold,fontSize:12,color:s.status==="live"?"#B42318":colors.inkSoft,letterSpacing:.8}}>{isHost ? "YOUR LIVE" : s.status==="live"?"LIVE NOW":"UP NEXT"}</Text>
      <Text style={{fontFamily:fonts.semibold,fontSize:20,color:colors.ink}}>{s.title}</Text>
      <Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:colors.inkSoft}}>{s.description}</Text>
      {s.status==="live" ? <View style={{flexDirection:"row",alignItems:"center",gap:8}}><UsersThree size={15} color={colors.inkSoft}/><Text style={{fontFamily:fonts.medium,fontSize:12,color:colors.inkSoft}}>{count} {count===1?"person":"people"} here</Text><Text style={{fontFamily:fonts.medium,fontSize:12,color:talking?"#B42318":colors.inkSoft}}>{talking?"· People are talking":"· Waiting"}</Text></View> : null}
      <ActionButton label={isHost ? "Resume hosting" : s.status==="live"?"Join Live":"View session"} onPress={()=>router.push({pathname:"/live/session",params:{id:s.id,...(isHost?{host:"1"}:{})}} as Href)}/></View>;
    }):<View style={{padding:20,borderRadius:23,backgroundColor:"#F6F3F1",gap:10}}>
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
