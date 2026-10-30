import assert from "node:assert/strict";
import test from "node:test";

import { applyRoomNote, applyRoomUltras } from "./channel";
import type { RoomUltra } from "./cards";

const ultra: RoomUltra = {
  id: "u1",
  title: "Why it happens: Hydrating Cleanser",
  path: "why",
  productName: "Hydrating Cleanser",
  sparks: 10,
  goal: 500,
  supporters: [{ name: "Ada" }],
  author: "Ada",
  pinned: false,
};

test("chat replays do not duplicate, and a timeline rides along", () => {
  const experience = {
    id: "j1",
    productName: "Hydrating Cleanser",
    duration: "3 weeks",
    outcome: "Tightness eased",
    reactions: ["Nightly"],
    author: "Ada",
    entries: [{ id: "e1", at: "2026-10-01", note: "Tight on night one." }],
  };
  const once = applyRoomNote([], { type: "chat", id: "c1", text: "Still pills", experience }, "Ada");
  const twice = applyRoomNote(once, { type: "chat", id: "c1", text: "Still pills", experience }, "Ada");
  assert.equal(twice.length, 1);
  assert.equal(twice[0].experience?.productName, "Hydrating Cleanser");
  assert.equal(twice[0].experience?.entries[0]?.note, "Tight on night one.");
  assert.equal(applyRoomNote(twice, { type: "chat", id: "c2", text: "   " }, "Ada").length, 1);
});

test("ultra, spark, and pin events are idempotent and never invent a card", () => {
  const opened = applyRoomUltras([], { type: "ultra", card: ultra });
  const replay = applyRoomUltras(opened, { type: "ultra", card: ultra });
  assert.equal(replay.length, 1);
  assert.equal(replay[0].sparks, 10);
  const sparked = applyRoomUltras(replay, { type: "spark", id: "u1", sparks: 20, supporters: [{ name: "Ada" }, { name: "Bea" }] });
  const stale = applyRoomUltras(sparked, { type: "spark", id: "u1", sparks: 20, supporters: [{ name: "Ada" }, { name: "Bea" }] });
  const older = applyRoomUltras(stale, { type: "ultra", card: ultra });
  assert.equal(older[0].sparks, 20);
  assert.equal(older[0].supporters.length, 2);
  assert.equal(applyRoomUltras(older, { type: "spark", id: "missing", sparks: 30, supporters: [] }).length, 1);
  const pinned = applyRoomUltras(older, { type: "pin", id: "u1" });
  assert.equal(pinned[0].pinned, true);
  assert.equal(applyRoomUltras(pinned, { type: "pin", id: "u1" })[0].pinned, true);
});

test("session-shaped payloads are ignored", () => {
  const notes = applyRoomNote([], { mic_requests: [], type: "presence" }, "Ada");
  const ultras = applyRoomUltras([ultra], { metadata: { mic_requests: [] } });
  assert.equal(notes.length, 0);
  assert.equal(ultras[0].sparks, 10);
});
