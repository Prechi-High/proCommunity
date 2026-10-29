import { createClient } from "@supabase/supabase-js";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

function httpHost(value) {
  const url = new URL(value);
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol === "ws:") url.protocol = "http:";
  return url.toString().replace(/\/$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  try {
    const authorization = req.headers.authorization || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return send(res, 401, { error: "Sign in required." });

    const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return send(res, 401, { error: "Invalid session." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const mode = String(body.mode || "");
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();

    if (!["live", "room"].includes(mode)) return send(res, 400, { error: "Invalid session mode." });
    if (!title) return send(res, 400, { error: "A title is required." });

    const { data: creator, error: creatorError } = await supabase
      .from("unmask_creators")
      .select("user_id,status,published")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (creatorError || !creator || creator.user_id !== userData.user.id || !creator.published || !["trial", "active", "expert", "verified_professional"].includes(creator.status)) {
      return send(res, 403, { error: "Creator access is not active." });
    }

    const { data: existingSession, error: existingSessionError } = await supabase
      .from("unmask_realtime_sessions")
      .select("id,mode,title,status")
      .eq("host_creator_id", userData.user.id)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingSessionError) throw existingSessionError;
    if (existingSession) {
      return send(res, 409, {
        error: `You already have a live ${existingSession.mode === "room" ? "Room" : "broadcast"}.`,
        sessionId: existingSession.id,
        mode: existingSession.mode,
      });
    }

    const { RoomServiceClient } = await import("livekit-server-sdk");
    const livekitUrl = env("LIVEKIT_URL");
    const apiKey = env("LIVEKIT_API_KEY");
    const apiSecret = env("LIVEKIT_API_SECRET");
    const roomName = `unmask-${crypto.randomUUID()}`;
    const roomService = new RoomServiceClient(httpHost(livekitUrl), apiKey, apiSecret);

    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 10 * 60,
      departureTimeout: 30,
      maxParticipants: mode === "room" ? 50 : 100,
    });

    const { data: session, error: sessionError } = await supabase
      .from("unmask_realtime_sessions")
      .insert({
        mode,
        host_creator_id: userData.user.id,
        title,
        description,
        status: "live",
        room_name: roomName,
        started_at: new Date().toISOString(),
        recording_status: "not_requested",
        transcript_status: "not_requested",
        metadata: {
          participant_count: 0,
          active_speaker_count: 0,
          active_speaker_name: "",
          last_activity_at: null,
          cohost_ids: [],
        },
      })
      .select("id,room_name,mode")
      .single();

    if (sessionError || !session) {
      try { await roomService.deleteRoom(roomName); } catch {}
      throw sessionError || new Error("The session was created without an id.");
    }

    return send(res, 200, session);
  } catch (error) {
    console.error("realtime session create error", error);
    const message = error instanceof Error ? error.message : "Could not create realtime session.";
    const providerError = /invalid token|unauthorized|forbidden/i.test(message);
    return send(res, providerError ? 502 : 500, {
      error: providerError
        ? "LiveKit credentials are not accepted by the configured LiveKit project."
        : message,
    });
  }
}
