export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...headers } });
}

export function requestId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}
