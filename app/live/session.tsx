import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Room as LiveKitRoom, RoomEvent } from "livekit-client";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { UsersThree } from "@/components/icons";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/constants/theme";

export default function LiveSession(){
 const {id}=useLocalSearchParams<{id?:string}>(); const router=useRouter();
 const roomRef=useRef<LiveKitRoom|null>(null); const [state,setState]=useState("connecting"); const [count,setCount]=useState(0);
 useEffect(()=>{let dead=false; if(!id)return; (async()=>{try{
   if(!supabase)throw new Error("Connection unavailable.");
   const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token)throw new Error("Sign in required.");
   const res=await fetch("/api/realtime/token",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({sessionId:id,role:"viewer"})});
   const payload=await res.json(); if(!res.ok)throw new Error(payload.error||"Could not join Live.");
   const room=new LiveKitRoom(); roomRef.current=room;
   const sync=()=>setCount(room.remoteParticipants.size);
   room.on(RoomEvent.ParticipantConnected,sync).on(RoomEvent.ParticipantDisconnected,sync).on(RoomEvent.Disconnected,()=>!dead&&setState("ended"));
   await room.connect(payload.serverUrl,payload.participantToken); if(dead)return; sync(); setState("connected");
 }catch(e){if(!dead)setState(e instanceof Error?e.message:"Could not join Live.")}})();
 return()=>{dead=true;roomRef.current?.disconnect();roomRef.current=null}},[id]);
 const leave=()=>{roomRef.current?.disconnect();router.back()};
 return <AppShell back title="Live session"><View style={{gap:16}}>
   {state==="connecting"?<StatusMessage title="Joining Live…" detail="Connecting you to the creator broadcast."/>:state==="connected"?<>
    <View style={{padding:20,borderRadius:24,backgroundColor:"#2A0E16",gap:12}}><View style={{flexDirection:"row",alignItems:"center",gap:9}}><View style={{width:9,height:9,borderRadius:9,backgroundColor:"#EE8C7C"}}/><Text style={{fontFamily:fonts.semibold,fontSize:12,color:"#fff",letterSpacing:1}}>LIVE</Text></View><Text style={{fontFamily:fonts.semibold,fontSize:27,lineHeight:32,color:"#fff"}}>You're in.</Text><Text style={{fontFamily:fonts.regular,fontSize:14,lineHeight:21,color:"#E9D8E0"}}>Watch the investigation, follow the conversation, and ask through the live interface when it is available.</Text></View>
    <View style={{padding:20,borderRadius:22,backgroundColor:"#F6F3F1",gap:12}}><UsersThree size={24} color={colors.brandDeep}/><Text style={{fontFamily:fonts.semibold,fontSize:18,color:colors.ink}}>{count} other {count===1?"person":"people"} in the room</Text><Text style={{fontFamily:fonts.regular,fontSize:14,color:colors.inkSoft}}>Viewer audio and camera stay off by default.</Text></View>
    <ActionButton tone="secondary" label="Leave Live" onPress={leave}/>
   </>:<StatusMessage title={state==="ended"?"Live ended":"Couldn't join Live"} detail={state==="ended"?"The session has ended.":"Check your connection and try again."}/>}
 </View></AppShell>;
}
