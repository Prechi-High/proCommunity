import assert from "node:assert/strict";
import { test } from "node:test";
import { backoffSec, processJob } from "../worker.ts";
import { WhatsAppError } from "../types.ts";
import { linkedUser, recordingClient, world } from "../../__tests__/fakes.ts";

async function runAll(w: ReturnType<typeof world>) {
  const results: string[] = [];
  for (let i = 0; i < 5; i++) {
    const jobs = await w.wa.repo.claimJobs("test", 10);
    if (!jobs.length) break;
    for (const j of jobs) results.push(await processJob(j, w.deps));
  }
  return results;
}

test("research_text job creates a card, runs existing intelligence and reports back", async () => {
  const w = world();
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.enqueue("research_text", { connectionId: conn.id, userId, waId, query: "CeraVe Foaming Cleanser" });
  assert.deepEqual(await runAll(w), ["done"]);
  assert.equal(w.rr.cards.length, 1);
  assert.equal(w.rr.cards[0].user_id, userId);
  assert.equal(w.rr.cards[0].source_channel, "whatsapp");
  assert.ok(["complete", "partial"].includes(w.rr.cards[0].status));
  assert.ok(w.calls.includes("search:CeraVe Foaming Cleanser"));
  assert.equal(w.sent.at(-1)?.kind, "buttons");
  const conv = await w.wa.repo.conversationFor(conn.id);
  assert.equal(conv.active_research_card_id, w.rr.cards[0].id);
});

test("recent research for the same product is offered instead of duplicated", async () => {
  const w = world();
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.enqueue("research_text", { connectionId: conn.id, userId, waId, query: "CeraVe Foaming Cleanser" });
  await runAll(w);
  await w.wa.repo.enqueue("research_text", { connectionId: conn.id, userId, waId, query: "CeraVe Foaming Cleanser" });
  await runAll(w);
  assert.equal(w.rr.cards.length, 1);
  assert.match(w.sent.at(-1)?.body ?? "", /researched .* recently/);
});

test("image research: identified product becomes a card and the image is not persisted", async () => {
  const w = world();
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.enqueue("research_image", { connectionId: conn.id, userId, waId, mediaId: "M1", mimeType: "image/jpeg" });
  assert.deepEqual(await runAll(w), ["done"]);
  assert.ok(w.calls.includes("identify"));
  assert.equal(w.rr.cards.length, 1);
  assert.equal(w.rr.cards[0].image_url === null || !String(w.rr.cards[0].image_url).includes("fbsbx"), true);
});

test("image research: photos of people are declined without analysis", async () => {
  const w = world({ identify: { looksLikePerson: true } });
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.enqueue("research_image", { connectionId: conn.id, userId, waId, mediaId: "M1" });
  await runAll(w);
  assert.equal(w.rr.cards.length, 0);
  assert.equal(w.sent.at(-1)?.kind, "cta");
});

test("image research: low confidence asks the user instead of guessing", async () => {
  const w = world({ identify: { confidence: 0.55 } });
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.enqueue("research_image", { connectionId: conn.id, userId, waId, mediaId: "M1" });
  await runAll(w);
  assert.equal(w.rr.cards.length, 0);
  assert.equal(w.sent.at(-1)?.kind, "list");
});

test("expired media gets a friendly message and is not retried", async () => {
  const w = world();
  w.deps.client = recordingClient({
    retrieveMedia: async () => {
      throw new WhatsAppError("media_expired", "gone", false, null, 404);
    },
  }).client;
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.enqueue("research_image", { connectionId: conn.id, userId, waId, mediaId: "M1" });
  assert.deepEqual(await runAll(w), ["done"]);
});

test("retryable failures back off, then dead-letter after max attempts", async () => {
  const w = world();
  w.deps.client = recordingClient({
    retrieveMedia: async () => {
      throw new WhatsAppError("http_500", "down", true, null, 500);
    },
  }).client;
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.enqueue("research_image", { connectionId: conn.id, userId, waId, mediaId: "M1" }, { maxAttempts: 2 });
  assert.deepEqual(await runAll(w), ["retry", "dead"]);
  assert.equal(w.wa.jobs[0].status, "dead");
  assert.equal(backoffSec(1), 30);
  assert.equal(backoffSec(3), 120);
  assert.equal(backoffSec(20), 900);
});

test("jobs for a number that was disconnected are dropped", async () => {
  const w = world();
  const { userId, waId, conn } = await linkedUser(w);
  await w.wa.repo.disconnect({ waId });
  await w.wa.repo.enqueue("research_text", { connectionId: conn.id, userId, waId, query: "CeraVe" });
  await runAll(w);
  assert.equal(w.rr.cards.length, 0);
});
