import assert from "node:assert/strict";
import { test } from "node:test";
import { hmacSha256Hex } from "../../core/crypto.ts";
import { eventKey, parseWebhook, verifySignature, verifySubscription } from "../webhook.ts";

const envelope = (value: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "PNID", display_phone_number: "1" }, ...value } }] }],
});

test("GET verification returns the challenge only for the right verify token", () => {
  const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "secret", "hub.challenge": "123" });
  assert.equal(verifySubscription(ok, "secret"), "123");
  assert.equal(verifySubscription(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1" }), "secret"), null);
  assert.equal(verifySubscription(ok, ""), null);
});

test("signature: valid HMAC passes, tampered body and missing header fail", async () => {
  const body = JSON.stringify({ hello: "world" });
  const sig = `sha256=${await hmacSha256Hex("app-secret", body)}`;
  assert.equal(await verifySignature(body, sig, "app-secret"), true);
  assert.equal(await verifySignature(body + " ", sig, "app-secret"), false);
  assert.equal(await verifySignature(body, null, "app-secret"), false);
  assert.equal(await verifySignature(body, sig, ""), false);
});

test("parses text, image, button and flow replies into normalised messages", () => {
  const parsed = parseWebhook(
    envelope({
      contacts: [{ wa_id: "234801", profile: { name: "A" } }],
      messages: [
        { id: "wamid.1", from: "234801", timestamp: "1700000000", type: "text", text: { body: "  CeraVe cleanser " } },
        { id: "wamid.2", from: "234801", timestamp: "1700000001", type: "image", image: { id: "MEDIA1", mime_type: "image/jpeg", caption: "is this good?" } },
        { id: "wamid.3", from: "234801", timestamp: "1700000002", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "LIST", title: "My Research" } } },
        { id: "wamid.4", from: "234801", timestamp: "1700000003", type: "interactive", interactive: { type: "nfm_reply", nfm_reply: { response_json: '{"flow_token":"x"}', body: "Sent", name: "flow" } } },
        { id: "wamid.5", from: "234801", timestamp: "1700000004", type: "sticker", sticker: { id: "S" } },
      ],
    }),
  );
  assert.ok(parsed);
  assert.deepEqual(parsed.messages.map((m) => m.kind), ["text", "image", "action", "flow_reply", "unsupported"]);
  assert.equal(parsed.messages[0].text, "CeraVe cleanser");
  assert.equal(parsed.messages[1].image?.mediaId, "MEDIA1");
  assert.equal(parsed.messages[2].actionId, "LIST");
  assert.deepEqual(parsed.messages[3].flowResponse, { flow_token: "x" });
  assert.equal(parsed.messages[0].phoneNumberId, "PNID");
});

test("parses delivery statuses and produces stable dedupe keys", () => {
  const parsed = parseWebhook(envelope({ statuses: [{ id: "wamid.9", status: "delivered", timestamp: "1700000000", recipient_id: "234801" }] }));
  assert.ok(parsed);
  assert.equal(parsed.statuses[0].status, "delivered");
  assert.equal(eventKey.status(parsed.statuses[0]), "st:wamid.9:delivered");
  const again = parseWebhook(envelope({ statuses: [{ id: "wamid.9", status: "delivered", timestamp: "1700000000", recipient_id: "234801" }] }));
  assert.equal(eventKey.status(again!.statuses[0]), eventKey.status(parsed.statuses[0]));
});

test("rejects payloads that are not WhatsApp webhooks", () => {
  assert.equal(parseWebhook({ foo: 1 }), null);
  assert.equal(parseWebhook(null), null);
});
