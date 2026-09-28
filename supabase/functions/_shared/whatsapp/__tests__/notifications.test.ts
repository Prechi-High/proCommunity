import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedByPreferences, deliverNotification } from "../notifications.ts";
import { canSendFreeformMessage } from "../policy.ts";
import { linkedUser, uuid, world } from "../../__tests__/fakes.ts";

test("product drops are never allowed by default preferences", () => {
  assert.equal(allowedByPreferences("product_drop", {}), false);
  assert.equal(allowedByPreferences("product_drop", null), false);
  assert.equal(allowedByPreferences("product_drop", { product_drops: true }), true);
  assert.equal(allowedByPreferences("price_drop", {}), true);
  assert.equal(allowedByPreferences("price_drop", { price_alerts: false }), false);
});

test("product drop to a default-preference user is skipped and recorded", async () => {
  const w = world();
  const { userId } = await linkedUser(w);
  const out = await deliverNotification({ userId, type: "product_drop", entityId: uuid(), payload: { brand: "CeraVe", title: "New serum" } }, { repo: w.wa.repo, client: w.client, notificationsEnabled: true });
  assert.equal(out, "skipped");
  assert.equal(w.sent.length, 0);
  assert.equal(w.wa.deliveries[0].error, "preference_off");
});

test("inside the 24h window a free-form message is sent and the delivery marked sent", async () => {
  const w = world();
  const { userId } = await linkedUser(w);
  const out = await deliverNotification({ userId, type: "research_updated", entityId: uuid(), payload: { title: "CeraVe", reference: "SR-1" } }, { repo: w.wa.repo, client: w.client, notificationsEnabled: true });
  assert.equal(out, "sent");
  assert.equal(w.sent[0].kind, "buttons");
  assert.equal(w.wa.deliveries[0].status, "sent");
});

test("outside the window without an approved template nothing is sent", async () => {
  const w = world();
  const { userId, conn } = await linkedUser(w);
  conn.last_inbound_at = new Date(Date.now() - 30 * 3600_000).toISOString();
  const out = await deliverNotification({ userId, type: "price_drop", entityId: uuid(), payload: { title: "X", then: "1", now: "2" } }, { repo: w.wa.repo, client: w.client, notificationsEnabled: true });
  assert.equal(out, "skipped");
  assert.equal(w.sent.length, 0);
});

test("outside the window an approved template is used", async () => {
  process.env.WHATSAPP_APPROVED_TEMPLATES = "sourced_price_drop_v1";
  try {
    const w = world();
    const { userId, conn } = await linkedUser(w);
    conn.last_inbound_at = new Date(Date.now() - 30 * 3600_000).toISOString();
    const out = await deliverNotification({ userId, type: "price_drop", entityId: uuid(), payload: { title: "X", then: "1", now: "2" } }, { repo: w.wa.repo, client: w.client, notificationsEnabled: true });
    assert.equal(out, "sent");
    assert.equal(w.sent[0].kind, "template");
    assert.equal(w.sent[0].body, "sourced_price_drop_v1");
  } finally {
    delete process.env.WHATSAPP_APPROVED_TEMPLATES;
  }
});

test("disabled flag or no connection means no delivery", async () => {
  const w = world();
  const { userId } = await linkedUser(w);
  assert.equal(await deliverNotification({ userId, type: "research_updated", entityId: uuid(), payload: {} }, { repo: w.wa.repo, client: w.client, notificationsEnabled: false }), "skipped");
  assert.equal(await deliverNotification({ userId: uuid(), type: "research_updated", entityId: uuid(), payload: {} }, { repo: w.wa.repo, client: w.client, notificationsEnabled: true }), "skipped");
  assert.equal(w.sent.length, 0);
});

test("window policy", () => {
  const now = new Date();
  assert.equal(canSendFreeformMessage({ status: "active", last_inbound_at: new Date(now.getTime() - 3600_000).toISOString() }, now), true);
  assert.equal(canSendFreeformMessage({ status: "active", last_inbound_at: new Date(now.getTime() - 25 * 3600_000).toISOString() }, now), false);
  assert.equal(canSendFreeformMessage({ status: "disconnected", last_inbound_at: now.toISOString() }, now), false);
});
