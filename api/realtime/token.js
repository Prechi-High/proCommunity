const { createClient } = require("@supabase/supabase-js");

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing " + name);
  return value;
}

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

function websocketUrl(value) {
  const url = new URL(value);
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  return url.toString().replace(/\/$/, "");
}

function httpHost(value) {
  const url = new URL(value);
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol === "ws:") url.protocol = "http:";
  return url.toString().replace(/\/$/, "");
}

async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

    const authorization = req.headers.authorization || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return send(res, 401, { error: "Sign in required." });

    const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return send(res, 401, { error: "Invalid session." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const sessionId = String(body.sessionId || "");
    const action = String(body.action || "");

    if (action) {
      if (!sessionId) return send(res, 400, { error: "sessionId is required." });

      if (action === "request_mic") {
        const { data: requestSession, error: requestSessionError } = await supabase
          .from("unmask_realtime_sessions").select("id,status,mode,metadata")
          .eq("id", sessionId).single();
        if (requestSessionError || !requestSession) return send(res, 404, { error: "Session not found." });
        if (requestSession.status !== "live" || requestSession.mode !== "room") return send(res, 409, { error: "Mic requests are only available in live audio Rooms." });

        const metadata = requestSession.metadata && typeof requestSession.metadata === "object" ? requestSession.metadata : {};
        const requests = Array.isArray(metadata.mic_requests) ? metadata.mic_requests : [];
        const existing = requests.find(item => String(item?.user_id) === userData.user.id);
        if (existing?.status === "pending") return send(res, 200, { ok: true, request: existing });
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userData.user.id).maybeSingle();
        const { data: creatorProfile } = await supabase.from("unmask_creators").select("display_name").eq("user_id", userData.user.id).maybeSingle();
        const request = {
          user_id: userData.user.id,
          display_name: creatorProfile?.display_name || profile?.display_name || userData.user.user_metadata?.display_name || "Unmasker",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const nextRequests = requests.filter(item => String(item?.user_id) !== userData.user.id);
        nextRequests.push(request);
        const { error: updateError } = await supabase.from("unmask_realtime_sessions")
          .update({ metadata: { ...metadata, mic_requests: nextRequests } }).eq("id", sessionId);
        if (updateError) throw updateError;
        return send(res, 200, { ok: true, request });
      }

      if (action === "sync_presence") {
        const { data: presenceSession, error: presenceError } = await supabase
          .from("unmask_realtime_sessions").select("id,status,room_name,metadata")
          .eq("id", sessionId).single();
        if (presenceError || !presenceSession) return send(res, 404, { error: "Session not found." });
        if (presenceSession.status !== "live") return send(res, 409, { error: "This session is no longer live." });

        let participants = [];
        if (presenceSession.room_name) {
          try {
            const { RoomServiceClient } = await import("livekit-server-sdk");
            participants = await new RoomServiceClient(
              httpHost(env("LIVEKIT_URL")), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET")
            ).listParticipants(presenceSession.room_name);
          } catch (error) {
            console.error("livekit presence lookup failed", error);
          }
        }

        const count = Array.isArray(participants) ? participants.length : 0;
        const requestedActiveCount = Number(body.activeSpeakerCount || 0);
        const activeSpeakerCount = Number.isFinite(requestedActiveCount)
          ? Math.max(0, Math.min(requestedActiveCount, count)) : 0;
        const activeSpeakerName = typeof body.activeSpeakerName === "string"
          ? body.activeSpeakerName.slice(0, 120) : "";
        const metadata = presenceSession.metadata && typeof presenceSession.metadata === "object"
          ? presenceSession.metadata : {};

        await supabase.from("unmask_realtime_sessions").update({
          metadata: {
            ...metadata,
            participant_count: count,
            active_speaker_count: activeSpeakerCount,
            active_speaker_name: activeSpeakerCount > 0 ? activeSpeakerName : "",
            last_activity_at: activeSpeakerCount > 0 ? new Date().toISOString() : (metadata.last_activity_at || null),
          },
        }).eq("id", sessionId);

        return send(res, 200, { ok: true, participantCount: count, activeSpeakerCount });
      }

      const { data: managedSession, error: managedSessionError } = await supabase
        .from("unmask_realtime_sessions")
        .select("id,status,host_creator_id,room_name,metadata")
        .eq("id", sessionId).single();

      if (managedSessionError || !managedSession) return send(res, 404, { error: "Session not found." });
      if (managedSession.status !== "live") return send(res, 409, { error: "This session is no longer live." });
      const managedMetadata = managedSession.metadata && typeof managedSession.metadata === "object" ? managedSession.metadata : {};
      const managedCohostIds = Array.isArray(managedMetadata.cohost_ids) ? managedMetadata.cohost_ids.map(String) : [];
      const managedCohostPermissions = managedMetadata.cohost_permissions && typeof managedMetadata.cohost_permissions === "object" ? managedMetadata.cohost_permissions : {};
      const isRootHost = managedSession.host_creator_id === userData.user.id;
      const actorPermissions = managedCohostPermissions[userData.user.id] || {};
      if (!isRootHost && !managedCohostIds.includes(userData.user.id)) return send(res, 403, { error: "Only the host or a co-host can manage this session." });
      if (action === "end" && !isRootHost && !actorPermissions.can_end) return send(res, 403, { error: "You do not have permission to end this session." });

      if (action === "end") {
        const { error: endError } = await supabase.from("unmask_realtime_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", sessionId).eq("status", "live");
        if (endError) throw endError;

        if (managedSession.room_name) {
          try {
            const { RoomServiceClient } = await import("livekit-server-sdk");
            await new RoomServiceClient(
              httpHost(env("LIVEKIT_URL")), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET")
            ).deleteRoom(managedSession.room_name);
          } catch (error) {
            console.error("livekit delete room failed", error);
          }
        }
        return send(res, 200, { ok: true, action });
      }

      if (["add_cohost","remove_cohost","grant_end","revoke_end","grant_cohost_management","revoke_cohost_management","approve_mic","deny_mic"].includes(action)) {
        const targetUserId = String(body.targetUserId || "");
        if (!targetUserId) return send(res, 400, { error: "A user is required." });
        const metadata = managedSession.metadata && typeof managedSession.metadata === "object" ? managedSession.metadata : {};
        const cohostIds = Array.isArray(metadata.cohost_ids) ? metadata.cohost_ids.map(String) : [];
        const permissions = metadata.cohost_permissions && typeof metadata.cohost_permissions === "object" ? metadata.cohost_permissions : {};
        const root = managedSession.host_creator_id === userData.user.id;
        const actor = permissions[userData.user.id] || {};
        const managementAction = ["add_cohost","remove_cohost","grant_end","revoke_end","grant_cohost_management","revoke_cohost_management"].includes(action);
        if (!root && (!cohostIds.includes(userData.user.id) || (managementAction && !actor.can_manage_cohosts))) {
          return send(res, 403, { error: "You do not have permission to manage co-hosts." });
        }

        if (["add_cohost","remove_cohost"].includes(action)) {
          const { data: target } = await supabase.from("unmask_creators")
            .select("user_id,display_name,handle,creator_mark,status,published,avatar_url")
            .eq("user_id", targetUserId).maybeSingle();
          if (!target || !target.published || !["trial","active","expert","verified_professional"].includes(target.status)) {
            return send(res, 400, { error: "Only active Unmask Creators can be co-hosts." });
          }
          const nextIds = action === "add_cohost" ? Array.from(new Set([...cohostIds,targetUserId])) : cohostIds.filter(id => id !== targetUserId);
          const nextPermissions = { ...permissions };
          if (action === "add_cohost") nextPermissions[targetUserId] = nextPermissions[targetUserId] || { can_end:false, can_manage_cohosts:false };
          else delete nextPermissions[targetUserId];
          const { error } = await supabase.from("unmask_realtime_sessions").update({ metadata:{...metadata,cohost_ids:nextIds,cohost_permissions:nextPermissions} }).eq("id",sessionId);
          if (error) throw error;
          if (managedSession.room_name && action === "add_cohost") {
            try {
              const { RoomServiceClient } = await import("livekit-server-sdk");
              await new RoomServiceClient(httpHost(env("LIVEKIT_URL")),env("LIVEKIT_API_KEY"),env("LIVEKIT_API_SECRET")).updateParticipant(managedSession.room_name,targetUserId,{permission:{canPublish:true,canSubscribe:true,canPublishData:true}});
            } catch (error) { console.error("livekit cohost permission update skipped",error); }
          }
          return send(res,200,{ok:true,action,creator:target,cohostIds:nextIds,cohostPermissions:nextPermissions});
        }

        if (["grant_end","revoke_end","grant_cohost_management","revoke_cohost_management"].includes(action)) {
          if (!cohostIds.includes(targetUserId)) return send(res,400,{error:"That user is not a co-host."});
          const nextPermissions={...permissions,[targetUserId]:{...(permissions[targetUserId]||{}),
            ...(action==="grant_end"?{can_end:true}:{}),
            ...(action==="revoke_end"?{can_end:false}:{}),
            ...(action==="grant_cohost_management"?{can_manage_cohosts:true}:{}),
            ...(action==="revoke_cohost_management"?{can_manage_cohosts:false}:{})}};
          const {error}=await supabase.from("unmask_realtime_sessions").update({metadata:{...metadata,cohost_permissions:nextPermissions}}).eq("id",sessionId);
          if(error) throw error;
          return send(res,200,{ok:true,action,cohostPermissions:nextPermissions});
        }

        if (["approve_mic","deny_mic"].includes(action)) {
          const requests=Array.isArray(metadata.mic_requests)?metadata.mic_requests:[];
          if(!requests.some(item=>String(item?.user_id)===targetUserId && item?.status==="pending")) return send(res,404,{error:"Mic request not found."});
          const nextRequests=requests.map(item=>String(item?.user_id)===targetUserId&&item?.status==="pending"?{...item,status:action==="approve_mic"?"approved":"denied",updated_at:new Date().toISOString()}:item);
          const {error}=await supabase.from("unmask_realtime_sessions").update({metadata:{...metadata,mic_requests:nextRequests}}).eq("id",sessionId);
          if(error) throw error;
          if(action==="approve_mic"&&managedSession.room_name){try{
            const {RoomServiceClient}=await import("livekit-server-sdk");
            await new RoomServiceClient(httpHost(env("LIVEKIT_URL")),env("LIVEKIT_API_KEY"),env("LIVEKIT_API_SECRET")).updateParticipant(managedSession.room_name,targetUserId,{permission:{canPublish:true,canSubscribe:true,canPublishData:true}});
          }catch(error){console.error("livekit mic approval update skipped",error);}}
          return send(res,200,{ok:true,action,micRequests:nextRequests});
        }
      }

      return send(res, 400, { error: "Unknown action." });
    }

    const requestedRole = String(body.role || "viewer");
    if (!sessionId) return send(res, 400, { error: "sessionId is required." });
    if (!["viewer", "host", "cohost", "speaker", "requester"].includes(requestedRole)) {
      return send(res, 400, { error: "Invalid role." });
    }

    const { data: session, error: sessionError } = await supabase
      .from("unmask_realtime_sessions")
      .select("id,mode,status,host_creator_id,room_name,metadata")
      .eq("id", sessionId).single();

    if (sessionError || !session) return send(res, 404, { error: "Session not found." });
    if (session.status === "cancelled") return send(res, 409, { error: "Session is cancelled." });
    if (session.status !== "live") return send(res, 409, { error: "This session is no longer live." });

    let role = "viewer";
    const sessionMetadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
    const cohostIds = Array.isArray(sessionMetadata.cohost_ids) ? sessionMetadata.cohost_ids.map(String) : [];

    const { data: requesterCreator } = await supabase.from("unmask_creators")
      .select("user_id,status,published").eq("user_id", userData.user.id).maybeSingle();

    const creatorCanHost = !!requesterCreator && requesterCreator.published &&
      ["trial", "active", "expert", "verified_professional"].includes(requesterCreator.status);

    if (userData.user.id === session.host_creator_id) {
      if (!creatorCanHost) return send(res, 403, { error: "Your creator access is no longer active." });
      role = "host";
    } else if (requestedRole === "cohost" && creatorCanHost && cohostIds.includes(userData.user.id)) {
      role = "cohost";
    } else if (requestedRole === "host") {
      return send(res, 403, { error: "You are not the host of this session." });
    }

    const roomName = session.room_name || ("unmask-" + session.id);
    if (!session.room_name) {
      await supabase.from("unmask_realtime_sessions").update({ room_name: roomName }).eq("id", session.id);
    }

    const { AccessToken } = await import("livekit-server-sdk");
    const { data: profile } = await supabase.from("profiles").select("display_name")
      .eq("id", userData.user.id).maybeSingle();
    const { data: creatorProfile } = await supabase.from("unmask_creators")
      .select("display_name,handle,creator_mark").eq("user_id", userData.user.id).maybeSingle();

    const displayName = creatorProfile?.display_name || profile?.display_name ||
      userData.user.user_metadata?.display_name || "Unmasker";

    const at = new AccessToken(env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"), {
      identity: userData.user.id,
      name: displayName,
      metadata: JSON.stringify({
        handle: creatorProfile?.handle || null,
        creator_mark: creatorProfile?.creator_mark || null,
      }),
      ttl: "15m",
    });

    at.addGrant({
      roomJoin: true, room: roomName,
      canPublish: role === "host" || role === "cohost",
      canSubscribe: true, canPublishData: true,
    });

    const participantToken = await at.toJwt();

    return send(res, 200, {
      serverUrl: websocketUrl(env("LIVEKIT_URL")),
      participantToken, role, roomName, mode: session.mode,
    });
  } catch (error) {
    console.error("realtime token error", error);
    return send(res, 500, {
      error: error instanceof Error ? error.message : "Could not create realtime token.",
    });
  }
}

module.exports = handler;
