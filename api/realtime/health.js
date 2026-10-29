import { RoomServiceClient, AccessToken } from "livekit-server-sdk";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  let roomName = "";
  try {
    const livekitUrl = env("LIVEKIT_URL");
    const apiKey = env("LIVEKIT_API_KEY");
    const apiSecret = env("LIVEKIT_API_SECRET");
    const httpUrl = livekitUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");
    roomName = "unmask-health-" + crypto.randomUUID();

    const rooms = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await rooms.createRoom({ name: roomName, emptyTimeout: 60, maxParticipants: 2 });

    const at = new AccessToken(apiKey, apiSecret, { identity: "unmask-health", ttl: "5m" });
    at.addGrant({ roomJoin: true, room: roomName, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();

    const validation = await fetch(httpUrl + "/rtc/validate?access_token=" + encodeURIComponent(token));
    const body = await validation.text();

    return res.status(validation.ok ? 200 : 502).json({
      ok: validation.ok,
      roomService: true,
      tokenValidationStatus: validation.status,
      tokenValidationBody: body.slice(0, 300),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    if (roomName) {
      try {
        const livekitUrl = env("LIVEKIT_URL").replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");
        await new RoomServiceClient(livekitUrl, env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET")).deleteRoom(roomName);
      } catch {}
    }
  }
}
