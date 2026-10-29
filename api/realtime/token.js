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
  if (req.method === "GET") {
    try {
      const { AccessToken, TokenVerifier, RoomServiceClient } = await import("livekit-server-sdk");
      const url = env("LIVEKIT_URL"), key = env("LIVEKIT_API_KEY"), secret = env("LIVEKIT_API_SECRET");
      const room = "unmask-health-" + Date.now();
      const token = await new AccessToken(key, secret, { identity: "unmask-health-check", ttl: "2m" }).addGrant({ roomJoin: true, room, canSubscribe: true }).toJwt();
      const claims = await new TokenVerifier(key, secret).verify(token);
      const host = new URL(url);
      if (host.protocol === "wss:") host.protocol = "https:";
      if (host.protocol === "ws:") host.protocol = "http:";
      await new RoomServiceClient(host.toString().replace(/\/$/, ""), key, secret).listRooms([room]);
      return send(res, 200, { ok: true, tokenSignatureValid: Boolean(claims?.iss), serverApiReachable: true, urlProtocol: new URL(url).protocol });
    } catch (error) {
      return send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  try {
    const { AccessToken } = await import("livekit-server-sdk");
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
    const requestedRole = String(body.role || "viewer");
    if (!sessionId) return send(res, 400, { error: "sessionId is required." });
    if (!["viewer", "host", "speaker", "requester"].includes(requestedRole)) return send(res, 400, { error: "Invalid role." });

    const { data: session, error: sessionError } = await supabase
      .from("unmask_realtime_sessions")
      .select("id,mode,status,host_creator_id,room_name")
      .eq("id", sessionId)
      .single();
    if (sessionError || !session) return send(res, 404, { error: "Session not found." });
    if (session.status === "cancelled") return send(res, 409, { error: "Session is cancelled." });

    let role = "viewer";
    if (requestedRole === "host") {
      const { data: creator } = await supabase.from("unmask_creators").select("user_id,status,published").eq("user_id", userData.user.id).maybeSingle();
      if (!creator || creator.user_id !== session.host_creator_id || !["trial","active","expert","verified_professional"].includes(creator.status)) {
        return send(res, 403, { error: "You are not the host of this session." });
      }
      role = "host";
    } else if (requestedRole === "speaker" || requestedRole === "requester") {
      role = "viewer";
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
      canPublish: role === "host",
      canSubscribe: true,
      canPublishData: true,
    });

    return send(res, 200, {
      serverUrl: websocketUrl(env("LIVEKIT_URL")),
      participantToken: await at.toJwt(),
      role,
      roomName,
      mode: session.mode,
    });
  } catch (error) {
    console.error("realtime token error", error);
    return send(res, 500, { error: error instanceof Error ? error.message : "Could not create realtime token." });
  }
}
