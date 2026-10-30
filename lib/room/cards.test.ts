import assert from "node:assert/strict";
import test from "node:test";

import { applySpark, journeyDuration, momentsFromUpdates, pinUltra, timelineFromJourney, ultraConcern, ultraTitle, upsertById } from "./cards";

test("journey duration stays honest when the start date is missing", () => {
  assert.equal(journeyDuration(null), "In progress");
  assert.equal(journeyDuration("not-a-date"), "In progress");
  assert.equal(journeyDuration(new Date(Date.now() - 3 * 86400000).toISOString()), "3 days");
});

test("a timeline snapshot only uses fields on the journey", () => {
  const card = timelineFromJourney(
    {
      id: "j1",
      started_on: null,
      goal: "Less tightness",
      status: "active",
      frequency: "Nightly",
      acquisition: "Bought",
      unmask_catalog: { name: "Hydrating Cleanser", brand: "CeraVe", image_url: null },
    },
    "Ada",
  );
  assert.equal(card.productName, "Hydrating Cleanser");
  assert.equal(card.duration, "In progress");
  assert.deepEqual(card.reactions, ["Nightly", "Bought"]);
  assert.deepEqual(card.entries, []);
});

test("timeline chapters keep the dated note and drop empty ones", () => {
  const moments = momentsFromUpdates([
    { id: "a", created_at: "2026-10-01", changed: "Tight on night one.", reaction: "Sting" },
    { id: "b", created_at: "2026-10-14", changed: "   " },
  ]);
  assert.equal(moments.length, 1);
  assert.equal(moments[0].note, "Tight on night one.");
  assert.equal(moments[0].reaction, "Sting");
});

test("cards upsert by id and sparks replace rather than increment", () => {
  const first = upsertById([], { id: "a", sparks: 10 });
  const again = upsertById(first, { id: "a", sparks: 10 });
  assert.equal(again.length, 1);
  const sparked = applySpark(
    [{ id: "a", title: "Why", path: "why", productName: "Cleanser", sparks: 10, goal: 500, supporters: [], author: "Ada", pinned: false }],
    { id: "a", sparks: 20, supporters: [{ name: "Bea" }] },
  );
  assert.equal(sparked[0].sparks, 20);
  assert.equal(sparked[0].supporters.length, 1);
  const pinned = pinUltra(sparked, "a");
  assert.equal(pinned[0].pinned, true);
  assert.equal(pinUltra(pinned, "missing")[0].pinned, false);
  const stale = applySpark(sparked, { id: "a", sparks: 5, supporters: [] });
  assert.equal(stale[0].sparks, 20);
  assert.equal(ultraTitle("why", "Hydrating Cleanser").length >= 10, true);
  assert.match(ultraConcern("company", "Tight after week two"), /Ask the company/);
});
