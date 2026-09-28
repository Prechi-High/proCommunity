import assert from "node:assert/strict";
import { test } from "node:test";
import { Action, routeIntent, routeWithFallback } from "../intent.ts";

const CARD = "11111111-2222-4333-8444-555555555555";

test("deterministic commands", () => {
  assert.equal(routeIntent({ messageType: "text", text: "LINK wa_link_ABCDEFGHJKLMNPQRSTUV" }).intent, "CONNECT_ACCOUNT");
  assert.equal(routeIntent({ messageType: "text", text: "disconnect" }).intent, "DISCONNECT_ACCOUNT");
  assert.equal(routeIntent({ messageType: "text", text: "hi" }).intent, "HELP");
  assert.equal(routeIntent({ messageType: "text", text: "my research" }).intent, "LIST_RESEARCH");
  assert.deepEqual(routeIntent({ messageType: "text", text: "show my sunscreen research" }), { intent: "SEARCH_RESEARCH", query: "sunscreen" });
});

test("images always start image research", () => {
  assert.deepEqual(routeIntent({ messageType: "image" }), { intent: "START_RESEARCH", image: true });
});

test("button ids route to card actions and unknown ids never guess", () => {
  assert.deepEqual(routeIntent({ messageType: "action", actionId: Action.open(CARD) }), { intent: "OPEN_RESEARCH", cardId: CARD });
  assert.deepEqual(routeIntent({ messageType: "action", actionId: Action.save(CARD) }), { intent: "SAVE_PRODUCT", cardId: CARD });
  assert.deepEqual(routeIntent({ messageType: "action", actionId: "PICK:2" }), { intent: "PICK_CANDIDATE", index: 2 });
  assert.equal(routeIntent({ messageType: "action", actionId: "OPEN:not-a-uuid" }).intent, "UNKNOWN");
});

test("questions go to the active card; without one they are not treated as questions", () => {
  assert.deepEqual(routeIntent({ messageType: "text", text: "Is it safe for sensitive skin?", activeResearchCardId: CARD }), {
    intent: "ASK_RESEARCH_QUESTION",
    cardId: CARD,
    query: "Is it safe for sensitive skin?",
  });
  assert.equal(routeIntent({ messageType: "text", text: "Is it safe for sensitive skin?" }).intent, "UNKNOWN");
});

test("comparison uses the active card and captures the target", () => {
  assert.deepEqual(routeIntent({ messageType: "text", text: "compare with La Roche-Posay Effaclar", activeResearchCardId: CARD }), {
    intent: "COMPARE_PRODUCT",
    cardId: CARD,
    query: "La Roche-Posay Effaclar",
  });
  assert.deepEqual(routeIntent({ messageType: "text", text: "Cetaphil", activeResearchCardId: CARD, awaiting: "compare_target" }), {
    intent: "COMPARE_PRODUCT",
    cardId: CARD,
    query: "Cetaphil",
  });
});

test("short product names start research; satchel is recognised", () => {
  assert.deepEqual(routeIntent({ messageType: "text", text: "CeraVe foaming cleanser" }), { intent: "START_RESEARCH", query: "CeraVe foaming cleanser" });
  assert.deepEqual(routeIntent({ messageType: "text", text: "research Dyson Airwrap" }), { intent: "START_RESEARCH", query: "Dyson Airwrap" });
  assert.equal(routeIntent({ messageType: "text", text: "add to satchel", activeResearchCardId: CARD }).intent, "ADD_TO_SATCHEL");
});

test("LLM fallback is only consulted for unknown text and cannot pick unsafe intents", async () => {
  let called = 0;
  const classify = async () => (called++, "DISCONNECT_ACCOUNT" as const);
  const r1 = await routeWithFallback({ messageType: "text", text: "hi" }, classify);
  assert.equal(r1.intent, "HELP");
  assert.equal(called, 0);
  const long = "I was wondering about something that happened with my order and a product I bought some time ago and whether that matters";
  const r2 = await routeWithFallback({ messageType: "text", text: long }, classify);
  assert.equal(called, 1);
  assert.equal(r2.intent, "UNKNOWN");
});
