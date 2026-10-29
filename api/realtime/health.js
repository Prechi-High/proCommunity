function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

function httpHost(value) {
  return value.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://").replace(/\/$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

  try {
    const { AccessToken, RoomServiceClient, TokenVerifier } = await import("livekit-server-sdk");
    const url = env("LIVEKIT_URL");
    const apiKey = env("LIVEKIT_API_KEY");
    const apiSecret = env("LIVEKIT_API_SECRET");
    const roomName = `unmask-health-${Date.now()}`;

    const at = new AccessToken(apiKey, apiSecret, { identity: "unmask-health-check", ttl: "2m" });
    at.addGrant({ roomJoin: true, room: roomName, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();

    const verifier = new TokenVerifier(apiKey, apiSecret);
    const claims = await verifier.verify(token);

    const service = new RoomServiceClient(httpHost(url), apiKey, apiSecret);
    await service.listRooms([roomName]);

    return send(res, 200, {
      ok: true,
      urlProtocol: new URL(url).protocol,
      serverApiReachable: true,
      tokenSignatureValid: true,
      tokenIssuer: claims.iss,
      room: roomName,
    });
  } catch (error) {
    console.error("realtime health error", error);
    return send(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Realtime health check failed.",
    });
  }
}
