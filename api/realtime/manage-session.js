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
async function getContext(supabase, sessionId, userId) {
  const { data: session, error } = await supabase.from("unmask_realtime_sessions").select("id,mode,status,host_creator_id,room_name,metadata").eq("id", sessionId).single();
  if (error || !session) throw new Error("Session not found.");
  if (session.status !== "live") throw new Error("This session is no longer live.");
  if (session.host_creator_id !== userId) throw new Error("Only the host can manage this session.");
  return session;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  try {
    const authorization = req.headers.authorization || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return send(res, 401, { error: "Sign in required." });
    const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return send(res, 401, { error: "Invalid session." });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "");
    const sessionId = String(body.sessionId || "");
    if (!sessionId) return send(res, 400, { error: "sessionId is required." });
    const session = await getContext(supabase, sessionId, userData.user.id);

    if (action === "end") {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      if (session.room_name) {
        try { await new RoomServiceClient(httpHost(env("LIVEKIT_URL")), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET")).deleteRoom(session.room_name); } catch (error) { console.error("livekit delete room failed", error); }
      }
      await supabase.from("unmask_realtime_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", session.id);
      return send(res, 200, { ok: true, action });
    }

    if (action === "add_cohost" || action === "remove_cohost") {
      const targetUserId = String(body.targetUserId || "");
      if (!targetUserId) return send(res, 400, { error: "A creator is required." });
      const { data: target } = await supabase.from("unmask_creators").select("user_id,display_name,handle,creator_mark,status,published,avatar_url").eq("user_id", targetUserId).maybeSingle();
      if (!target || !target.published || !["trial","active","expert","verified_professional"].includes(target.status)) {
        return send(res, 400, { error: "Only active Unmask Creators can be co-hosts." });
      }
      const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
      const ids = Array.isArray(metadata.cohost_ids) ? metadata.cohost_ids.map(String) : [];
      const next = action === "add_cohost" ? Array.from(new Set([...ids, targetUserId])) : ids.filter((id) => id !== targetUserId);
      const nextMetadata = { ...metadata, cohost_ids: next };
      const { error } = await supabase.from("unmask_realtime_sessions").update({ metadata: nextMetadata }).eq("id", session.id);
      if (error) throw error;
      return send(res, 200, { ok: true, action, creator: target, cohostIds: next });
    }

    return send(res, 400, { error: "Unknown action." });
  } catch (error) {
    console.error("realtime manage error", error);
    return send(res, 500, { error: error instanceof Error ? error.message : "Could not manage session." });
  }
}
