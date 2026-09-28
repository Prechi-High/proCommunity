import assert from "node:assert/strict";
import { test } from "node:test";
import { cloudClient, normaliseMetaError } from "../client.ts";
import { WhatsAppError } from "../types.ts";

type Call = { url: string; init: RequestInit };
function mockMeta(respond: (call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const r = respond(call);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, client: cloudClient({ token: "TEST_TOKEN", phoneNumberId: "PNID", version: "v23.0", fetcher }) };
}

test("sends text via the configured Graph version with bearer auth", async () => {
  const { calls, client } = mockMeta(() => ({ status: 200, body: { messages: [{ id: "wamid.OK" }] } }));
  const id = await client.sendText("234801", "hello");
  assert.equal(id, "wamid.OK");
  assert.equal(calls[0].url, "https://graph.facebook.com/v23.0/PNID/messages");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer TEST_TOKEN");
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body, { messaging_product: "whatsapp", recipient_type: "individual", to: "234801", type: "text", text: { body: "hello", preview_url: false } });
});

test("reply buttons are capped at 3 with titles clipped to 20 chars", async () => {
  const { calls, client } = mockMeta(() => ({ status: 200, body: { messages: [{ id: "x" }] } }));
  await client.sendButtons("1", "pick", [1, 2, 3, 4].map((i) => ({ id: `B${i}`, title: `A very long button title ${i}` })));
  const buttons = JSON.parse(String(calls[0].init.body)).interactive.action.buttons;
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every((b: { reply: { title: string } }) => b.reply.title.length <= 20));
});

test("flow messages carry the opaque flow_token and data_exchange action", async () => {
  const { calls, client } = mockMeta(() => ({ status: 200, body: { messages: [{ id: "x" }] } }));
  await client.sendFlow("1", { body: "b", cta: "Open", flowId: "F1", flowToken: "ft_abc" });
  const params = JSON.parse(String(calls[0].init.body)).interactive.action.parameters;
  assert.deepEqual(params, { flow_message_version: "3", flow_token: "ft_abc", flow_id: "F1", flow_cta: "Open", flow_action: "data_exchange" });
});

test("Meta errors are normalised; rate limits and 5xx are retryable, bad params are not", async () => {
  const { client } = mockMeta(() => ({ status: 400, body: { error: { code: 131009, message: "Parameter value is not valid", fbtrace_id: "TRACE" } } }));
  await assert.rejects(client.sendText("1", "x"), (e: unknown) => e instanceof WhatsAppError && e.code === "meta_131009" && !e.retryable && e.requestId === "TRACE");
  assert.equal(normaliseMetaError(429, { error: { code: 130429 } }, null).retryable, true);
  assert.equal(normaliseMetaError(503, {}, null).retryable, true);
  assert.equal(normaliseMetaError(400, { error: { code: 100 } }, null).retryable, false);
});

test("error messages never include the access token", async () => {
  const { client } = mockMeta(() => ({ status: 401, body: { error: { code: 190, message: "Invalid OAuth access token" } } }));
  await assert.rejects(client.sendText("1", "x"), (e: unknown) => e instanceof Error && !e.message.includes("TEST_TOKEN"));
});

test("media downloads only from Meta hosts and treat 404 as expired", async () => {
  const { client } = mockMeta(() => ({ status: 404, body: {} }));
  await assert.rejects(client.downloadMedia("https://evil.example.com/x", 100), (e: unknown) => e instanceof WhatsAppError && e.code === "media_host");
  await assert.rejects(client.downloadMedia("https://lookaside.fbsbx.com/x", 100), (e: unknown) => e instanceof WhatsAppError && e.code === "media_expired" && !e.retryable);
});

test("missing credentials fail closed", async () => {
  const client = cloudClient({ token: "", phoneNumberId: "", fetcher: (async () => new Response("{}")) as unknown as typeof fetch });
  await assert.rejects(client.sendText("1", "x"), (e: unknown) => e instanceof WhatsAppError && e.code === "not_configured");
});
