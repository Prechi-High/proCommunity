import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256Hex } from "../../core/crypto.ts";
import { completeLink, createLinkToken, updatePreferences } from "../connections.ts";
import { memoryWhatsAppRepo, uuid } from "../../__tests__/fakes.ts";

test("link token: only the hash is stored and the raw token has the wa_link_ format", async () => {
  const { repo, tokens } = memoryWhatsAppRepo();
  const out = await createLinkToken(repo, uuid());
  assert.match(out.token, /^wa_link_[A-Za-z0-9]{24}$/);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].token_hash, await sha256Hex(out.token));
  assert.ok(!JSON.stringify(tokens).includes(out.token));
  const ttl = new Date(out.expiresAt).getTime() - Date.now();
  assert.ok(ttl > 10 * 60_000 && ttl <= 15 * 60_000);
});

test("link completion maps the WhatsApp number to the token owner", async () => {
  const { repo } = memoryWhatsAppRepo();
  const userId = uuid();
  const { token } = await createLinkToken(repo, userId);
  const res = await completeLink(repo, "2348011111111", token);
  assert.equal(res.ok, true);
  const conn = await repo.connectionByWaId("2348011111111");
  assert.equal(conn?.user_id, userId);
  assert.equal(conn?.status, "active");
});

test("a link token cannot be reused", async () => {
  const { repo } = memoryWhatsAppRepo();
  const { token } = await createLinkToken(repo, uuid());
  assert.equal((await completeLink(repo, "2348011111111", token)).ok, true);
  const again = await completeLink(repo, "2348022222222", token);
  assert.deepEqual(again, { ok: false, reason: "used" });
  assert.equal(await repo.connectionByWaId("2348022222222"), null);
});

test("an expired link token is rejected and marked expired", async () => {
  const { repo, tokens } = memoryWhatsAppRepo();
  const { token } = await createLinkToken(repo, uuid(), new Date(Date.now() - 20 * 60_000));
  const res = await completeLink(repo, "2348011111111", token);
  assert.deepEqual(res, { ok: false, reason: "expired" });
  assert.equal(tokens[0].status, "expired");
});

test("malformed and unknown tokens are rejected", async () => {
  const { repo } = memoryWhatsAppRepo();
  assert.deepEqual(await completeLink(repo, "1", "not-a-token"), { ok: false, reason: "invalid" });
  assert.deepEqual(await completeLink(repo, "1", "wa_link_AAAAAAAAAAAAAAAAAAAAAAAA"), { ok: false, reason: "invalid" });
});

test("issuing a new token revokes older pending tokens", async () => {
  const { repo } = memoryWhatsAppRepo();
  const userId = uuid();
  const first = await createLinkToken(repo, userId);
  await createLinkToken(repo, userId);
  assert.deepEqual(await completeLink(repo, "2348011111111", first.token), { ok: false, reason: "invalid" });
});

test("linking a new number retires the account's previous active number", async () => {
  const { repo, connections } = memoryWhatsAppRepo();
  const userId = uuid();
  await completeLink(repo, "2348011111111", (await createLinkToken(repo, userId)).token);
  await completeLink(repo, "2348022222222", (await createLinkToken(repo, userId)).token);
  const active = connections.filter((c) => c.user_id === userId && c.status === "active");
  assert.equal(active.length, 1);
  assert.equal(active[0].wa_id, "2348022222222");
});

test("preferences: product drops stay off unless explicitly enabled; unknown keys are rejected", async () => {
  const { repo } = memoryWhatsAppRepo();
  const userId = uuid();
  await completeLink(repo, "2348011111111", (await createLinkToken(repo, userId)).token);
  const p1 = await updatePreferences(repo, userId, { price_alerts: false });
  assert.equal(p1?.product_drops, false);
  assert.equal(p1?.price_alerts, false);
  const p2 = await updatePreferences(repo, userId, { product_drops: true });
  assert.equal(p2?.product_drops, true);
  await assert.rejects(updatePreferences(repo, userId, { marketing_everything: true }));
});
