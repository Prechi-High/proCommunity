import { createClient } from "@supabase/supabase-js";

function env(name){const v=process.env[name];if(!v)throw new Error(`Missing ${name}`);return v;}
function send(res,s,b){res.status(s).setHeader("Content-Type","application/json").end(JSON.stringify(b));}
function httpHost(value){const u=new URL(value);if(u.protocol==="wss:")u.protocol="https:";if(u.protocol==="ws:")u.protocol="http:";return u.toString().replace(/\/$/,"");}

export default async function handler(req,res){
  if(req.method!=="GET") return send(res,405,{error:"Method not allowed."});
  try{
    const supabase=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await supabase.from("unmask_realtime_sessions")
      .select("id,mode,title,description,host_creator_id,started_at,room_name,metadata,unmask_creators(display_name,handle,avatar_url,creator_mark,verification_level)")
      .eq("status","live").in("mode",["live","room"]).order("started_at",{ascending:false}).limit(12);
    if(error) throw error;
    const {RoomServiceClient}=await import("livekit-server-sdk");
    const service=new RoomServiceClient(httpHost(env("LIVEKIT_URL")),env("LIVEKIT_API_KEY"),env("LIVEKIT_API_SECRET"));
    const rows=[];
    for(const row of data||[]){
      let participantCount=0;
      if(row.room_name){
        try { const participants=await service.listParticipants(row.room_name); participantCount=participants?.length || 0; } catch(error){ console.error("participant count failed",row.id,error); }
      }
      const creator=Array.isArray(row.unmask_creators)?row.unmask_creators[0]||null:row.unmask_creators||null;
      rows.push({
        id:row.id,mode:row.mode,title:row.title,description:row.description,host_creator_id:row.host_creator_id,
        started_at:row.started_at,participant_count:participantCount,
        creator,cohost_ids:Array.isArray(row.metadata?.cohost_ids)?row.metadata.cohost_ids.map(String):[],
      });
    }
    return send(res,200,{sessions:rows});
  }catch(error){
    console.error("active realtime error",error);
    return send(res,500,{error:error instanceof Error?error.message:"Could not load live sessions."});
  }
}
