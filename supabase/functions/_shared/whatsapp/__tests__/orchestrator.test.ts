import assert from "node:assert/strict";
import { test } from "node:test";
import type { InboundMessage } from "../types.ts";
import { Action } from "../intent.ts";
import { handleInbound } from "../orchestrator.ts";
import { linkedUser, uuid, world } from "../../__tests__/fakes.ts";

let n = 0;
const text = (from: string, body: string): InboundMessage => ({ id: `wamid.t${++n}`, from, timestamp: 0, phoneNumberId: "PNID", kind: "text", rawType: "text", text: body });
const action = (from: string, id: string): InboundMessage => ({ id: `wamid.a${++n}`, from, timestamp: 0, phoneNumberId: "PNID", kind: "action", rawType: "interactive", actionId: id });

async function readyCard(w: ReturnType<typeof world>, userId: string) {
  const card = await w.research.create({ userId, product: { productId: "cerave-foaming-cleanser", name: "Foaming Facial Cleanser", brand: "CeraVe" }, sourceChannel: "whatsapp" });
  await w.research.run(card.id);
  return card;
}

test("unlinked numbers only get the welcome message and nothing is queued", async () => {
  const w = world();
  const out = await handleInbound(text("2349999", "CeraVe cleanser"), w.deps);
  assert.equal(out.intent, "UNLINKED");
  assert.equal(w.wa.jobs.length, 0);
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].kind, "cta");
});

test("text research from a linked user is queued, not run inline", async () => {
  const w = world();
  const { waId } = await linkedUser(w);
  const out = await handleInbound(text(waId, "CeraVe foaming cleanser"), w.deps);
  assert.equal(out.intent, "START_RESEARCH");
  assert.equal(w.wa.jobs.length, 1);
  assert.equal(w.wa.jobs[0].kind, "research_text");
  assert.equal(w.calls.length, 0);
  assert.match(w.sent[0].body ?? "", /Researching/);
});

test("images are routed to image research", async () => {
  const w = world();
  const { waId } = await linkedUser(w);
  const img: InboundMessage = { id: "wamid.img", from: waId, timestamp: 0, phoneNumberId: "PNID", kind: "image", rawType: "image", image: { mediaId: "M1", mimeType: "image/jpeg", caption: null } };
  await handleInbound(img, w.deps);
  assert.equal(w.wa.jobs[0].kind, "research_image");
  assert.equal(w.wa.jobs[0].payload.mediaId, "M1");
});

test("IDOR: opening another user's Research Card looks like not-found", async () => {
  const w = world();
  const owner = await linkedUser(w, uuid(), "2348000000010");
  const attacker = await linkedUser(w, uuid(), "2348000000020");
  const card = await readyCard(w, owner.userId);
  await handleInbound(action(attacker.waId, Action.open(card.id)), w.deps);
  const last = w.sent.at(-1);
  assert.match(last?.body ?? "", /couldn't find that Research Card/);
  assert.ok(!(last?.body ?? "").includes(card.title ?? "Foaming"));
});

test("IDOR: saving or sharing another user's card is refused", async () => {
  const w = world();
  const owner = await linkedUser(w, uuid(), "2348000000011");
  const attacker = await linkedUser(w, uuid(), "2348000000021");
  const card = await readyCard(w, owner.userId);
  await handleInbound(action(attacker.waId, Action.save(card.id)), w.deps);
  await handleInbound(action(attacker.waId, Action.share(card.id)), w.deps);
  assert.equal(w.rr.saves.length, 0);
  assert.equal(w.rr.shares.length, 0);
});

test("questions about the active card are queued as ask jobs", async () => {
  const w = world();
  const { userId, waId, conn } = await linkedUser(w);
  const card = await readyCard(w, userId);
  const conv = await w.wa.repo.conversationFor(conn.id);
  await w.wa.repo.updateConversation(conv.id, { active_research_card_id: card.id });
  await handleInbound(text(waId, "Is it good for oily skin?"), w.deps);
  const job = w.wa.jobs.find((j) => j.kind === "ask");
  assert.ok(job);
  assert.equal(job.payload.cardId, card.id);
});

test("compare with a named product queues a compare job for the active card", async () => {
  const w = world();
  const { userId, waId, conn } = await linkedUser(w);
  const card = await readyCard(w, userId);
  const conv = await w.wa.repo.conversationFor(conn.id);
  await w.wa.repo.updateConversation(conv.id, { active_research_card_id: card.id });
  await handleInbound(text(waId, "compare with Cetaphil gentle cleanser"), w.deps);
  const job = w.wa.jobs.find((j) => j.kind === "compare");
  assert.equal(job?.payload.target, "Cetaphil gentle cleanser");
});

test("save uses the existing saved-products store and satchel explains it isn't available", async () => {
  const w = world();
  const { userId, waId } = await linkedUser(w);
  const card = await readyCard(w, userId);
  await handleInbound(action(waId, Action.save(card.id)), w.deps);
  assert.deepEqual(w.rr.saves, [{ userId, productId: "cerave-foaming-cleanser" }]);
  await handleInbound(text(waId, "add to satchel"), w.deps);
  assert.match(w.sent.at(-1)?.body ?? "", /Satchel isn't available/);
});

test("card actions without an active card ask for a product instead of failing", async () => {
  const w = world();
  const { waId } = await linkedUser(w);
  await handleInbound(text(waId, "save"), w.deps);
  assert.equal(w.rr.saves.length, 0);
});

test("DISCONNECT deactivates the connection", async () => {
  const w = world();
  const { waId } = await linkedUser(w);
  await handleInbound(text(waId, "disconnect"), w.deps);
  assert.equal((await w.wa.repo.connectionByWaId(waId))?.status, "disconnected");
});
