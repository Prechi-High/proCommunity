import { createClient } from "@supabase/supabase-js";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
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

export default async function handler(req, res) {
  try {
    const { AccessToken, RoomServiceClient } = await import("livekit-server-sdk");

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
      if (action === "sync_presence") {
        const { data: presenceSession, error: presenceError } = await supabase
          .from("unmask_realtime_sessions")
          .select("id,status,room_name,metadata")
          .eq("id", sessionId).single();
        if (presenceError || !presenceSession) return send(res, 404, { error: "Session not found." });
        if (presenceSession.status !== "live") return send(res, 409, { error: "This session is no longer live." });
        const participants = presenceSession.room_name
          ? await new RoomServiceClient(httpHost(env("LIVEKIT_URL")), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET")).listParticipants(presenceSession.room_name)
          : [];
        const count = Array.isArray(participants) ? participants.length : 0;
        const requestedActiveCount = Number(body.activeSpeakerCount || 0);
        const activeSpeakerCount = Number.isFinite(requestedActiveCount) ? Math.max(0, Math.min(requestedActiveCount, count)) : 0;
        const activeSpeakerName = typeof body.activeSpeakerName === "string" ? body.activeSpeakerName.slice(0, 120) : "";
        const metadata = presenceSession.metadata && typeof presenceSession.metadata === "object" ? presenceSession.metadata : {};
        const nextMetadata = {
          ...metadata,
          participant_count: count,
          active_speaker_count: activeSpeakerCount,
          active_speaker_name: activeSpeakerCount > 0 ? activeSpeakerName : "",
          last_activity_at: activeSpeakerCount > 0 ? new Date().toISOString() : (metadata.last_activity_at || null),
        };
        await supabase.from("unmask_realtime_sessions").update({ metadata: nextMetadata }).eq("id", sessionId);
        return send(res, 200, { ok: true, participantCount: count, activeSpeakerCount });
      }


      const { data: managedSession, error: managedSessionError } = await supabase
        .from("unmask_realtime_sessions")
        .select("id,status,host_creator_id,room_name,metadata")
        .eq("id", sessionId).single();
      if (managedSessionError || !managedSession) return send(res, 404, { error: "Session not found." });
      if (managedSession.status !== "live") return send(res, 409, { error: "This session is no longer live." });
      if (managedSession.host_creator_id !== userData.user.id) return send(res, 403, { error: "Only the host can manage this session." });

      if (action === "end") {
        if (managedSession.room_name) {
          try { await new RoomServiceClient(httpHost(env("LIVEKIT_URL")), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET")).deleteRoom(managedSession.room_name); } catch (error) { console.error("livekit delete room failed", error); }
        }
        await supabase.from("unmask_realtime_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
        return send(res, 200, { ok: true, action });
      }

      if (action === "add_cohost" || action === "remove_cohost") {
        const targetUserId = String(body.targetUserId || "");
        if (!targetUserId) return send(res, 400, { error: "A creator is required." });
        const { data: target } = await supabase.from("unmask_creators")
          .select("user_id,display_name,handle,creator_mark,status,published,avatar_url")
          .eq("user_id", targetUserId).maybeSingle();
        if (!target || !target.published || !["trial","active","expert","verified_professional"].includes(target.status)) {
          return send(res, 400, { error: "Only active Unmask Creators can be co-hosts." });
        }
        const metadata = managedSession.metadata && typeof managedSession.metadata === "object" ? managedSession.metadata : {};
        const ids = Array.isArray(metadata.cohost_ids) ? metadata.cohost_ids.map(String) : [];
        const next = action === "add_cohost" ? Array.from(new Set([...ids, targetUserId])) : ids.filter((id) => id !== targetUserId);
        const { error } = await supabase.from("unmask_realtime_sessions").update({ metadata: { ...metadata, cohost_ids: next } }).eq("id", sessionId);
        if (error) throw error;
        if (managedSession.room_name) {
          try {
            const roomService = new RoomServiceClient(httpHost(env("LIVEKIT_URL")), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
            await roomService.updateParticipant(managedSession.room_name, targetUserId, {
              permission: { canPublish: action === "add_cohost", canSubscribe: true, canPublishData: true },
            });
          } catch (error) { console.error("livekit cohost permission update skipped", error); }
        }
        return send(res, 200, { ok: true, action, creator: target, cohostIds: next });
      }
      return send(res, 400, { error: "Unknown action." });
    }
    const requestedRole = String(body.role || "viewer");
    if (!sessionId) return send(res, 400, { error: "sessionId is required." });
    if (!["viewer", "host", "cohost", "speaker", "requester"].includes(requestedRole)) return send(res, 400, { error: "Invalid role." });

    const { data: session, error: sessionError } = await supabase
      .from("unmask_realtime_sessions")
      .select("id,mode,status,host_creator_id,room_name,metadata")
      .eq("id", sessionId)
      .single();
    if (sessionError || !session) return send(res, 404, { error: "Session not found." });
    if (session.status === "cancelled") return send(res, 409, { error: "Session is cancelled." });

    let role = "viewer";
    const sessionMetadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
    const cohostIds = Array.isArray(sessionMetadata.cohost_ids) ? sessionMetadata.cohost_ids.map(String) : [];
    const { data: requesterCreator } = await supabase
      .from("unmask_creators")
      .select("user_id,status,published")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const creatorCanHost = !!requesterCreator &&
      requesterCreator.published &&
      ["trial","active","expert","verified_professional"].includes(requesterCreator.status);

    // The database is authoritative: the session owner is always the host,
    // regardless of how the client reached the session.
    if (userData.user.id === session.host_creator_id) {
      if (!creatorCanHost) return send(res, 403, { error: "Your creator access is no longer active." });
      role = "host";
    } else if (requestedRole === "cohost" && creatorCanHost && cohostIds.includes(userData.user.id)) {
      role = "cohost";
    } else if (requestedRole === "host") {
      return send(res, 403, { error: "You are not the host of this session." });
    }

    const roomName = session.room_name || `unmask-${session.id}`;
    if (!session.room_name) {
      await supabase.from("unmask_realtime_sessions").update({ room_name: roomName }).eq("id", session.id);
    }

    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userData.user.id).maybeSingle();
    const { data: creatorProfile } = await supabase.from("unmask_creators").select("display_name,handle,creator_mark").eq("user_id", userData.user.id).maybeSingle();
    const displayName = creatorProfile?.display_name || profile?.display_name || userData.user.user_metadata?.display_name || "Unmasker";
    const at = new AccessToken(env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"), {
      identity: userData.user.id,
      name: displayName,
      metadata: JSON.stringify({ handle: creatorProfile?.handle || null, creator_mark: creatorProfile?.creator_mark || null }),
      ttl: "15m",
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: role === "host" || role === "cohost",
      canSubscribe: true,
      canPublishData: true,
    });

    const participantToken = await at.toJwt();
    const livekitHttpUrl = env("LIVEKIT_URL")
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:")
      .replace(/\/$/, "");
    const validationResponse = await fetch(
      \`${livekitHttpUrl}/rtc/validate?access_token=\${encodeURIComponent(participantToken)}\`,
      { method: "GET", headers: { Accept: "application/json" } },
    );
    if (!validationResponse.ok) {
      const validationBody = await validationResponse.text();
      console.error("livekit token validation failed", {
        status: validationResponse.status,
        body: validationBody.slice(0, 500),
        roomName,
      });
      return send(res, 502, {
        error: \`LiveKit rejected the generated participant token (HTTP \${validationResponse.status}).\`,
        detail: validationBody.slice(0, 300),
      });
    }

    return send(res, 200, {
      serverUrl: websocketUrl(env("LIVEKIT_URL")),
      participantToken,
      role,
      roomName,
      mode: session.mode,
    });
  } catch (error) {
    console.error("realtime token error", error);
    return send(res, 500, { error: error instanceof Error ? error.message : "Could not create realtime token." });
  }
}
