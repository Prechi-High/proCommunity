import assert from "node:assert/strict";
import test from "node:test";

import { foldRoomEvents } from "./log";

const timeline = {
  id: "j1",
  productName: "Hydrating Cleanser",
  duration: "3 weeks",
  outcome: "Tightness eased",
  reactions: ["Tightness eased"],
  author: "Dee",
  entries: [],
  visibility: "public",
  frequency: "Nightly",
};

test("a replay of the saved Room log does not duplicate replies or sparks", () => {
  const rows = [
    { idempotency_key: "c1", author_name: "Dee", kind: "chat", payload: { text: "Still pills", experience: timeline } },
    { idempotency_key: "c1", author_name: "Dee", kind: "chat", payload: { text: "Still pills", experience: timeline } },
    { idempotency_key: "u1", author_name: "Dee", kind: "ultra", payload: { card: { id: "u1", title: "Why this happens: Hydrating Cleanser", path: "company", productName: "Hydrating Cleanser", sparks: 10, thunder: 0, goal: 500, supporters: [{ name: "Dee" }], author: "Dee", pinned: false } } },
    { idempotency_key: "s1", author_name: "Bea", kind: "spark", payload: { id: "u1", sparks: 20, thunder: 1, supporters: [{ name: "Dee" }, { name: "Bea" }] } },
    { idempotency_key: "r1", author_name: "Cal", kind: "reaction", payload: { kind: "hundred" } },
  ];
  const once = foldRoomEvents(rows);
  const twice = foldRoomEvents([...rows, ...rows]);
  assert.equal(once.notes.length, 1);
  assert.equal(once.notes[0].experience?.productName, "Hydrating Cleanser");
  assert.equal(once.ultras[0].sparks, 20);
  assert.equal(once.ultras[0].thunder, 1);
  assert.equal(once.reactionCount, 1);
  assert.equal(twice.notes.length, 1);
  assert.equal(twice.ultras.length, 1);
  assert.equal(twice.reactionCount, 1);
});
