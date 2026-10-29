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

  const result = {
    ok: false,
    urlProtocol: null,
    serverApiReachable: false,
    tokenCreated: false,
    tokenSignatureValid: false,
  };

  try {
    const { AccessToken, RoomServiceClient, TokenVerifier } = await import("livekit-server-sdk");
    const url = env("LIVEKIT_URL");
    const apiKey = env("LIVEKIT_API_KEY");
    const apiSecret = env("LIVEKIT_API_SECRET");
    result.urlProtocol = new URL(url).protocol;

    const roomName = `unmask-health-${Date.now()}`;
    const at = new AccessToken(apiKey, apiSecret, { identity: "unmask-health-check", ttl: "2m" });
    at.addGrant({ roomJoin: true, room: roomName, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();
    result.tokenCreated = Boolean(token);

    try {
      const verifier = new TokenVerifier(apiKey, apiSecret);
      const claims = await verifier.verify(token);
      result.tokenSignatureValid = Boolean(claims?.iss);
    } catch (error) {
      return send(res, 500, { ...result, stage: "token-verification", error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const service = new RoomServiceClient(httpHost(url), apiKey, apiSecret);
      await service.listRooms([roomName]);
      result.serverApiReachable = true;
    } catch (error) {
      return send(res, 500, { ...result, stage: "server-api", error: error instanceof Error ? error.message : String(error), httpHost: httpHost(url) });
    }

    return send(res, 200, { ...result, ok: true });
  } catch (error) {
    return send(res, 500, { ...result, stage: "setup", error: error instanceof Error ? error.message : String(error) });
  }
}
