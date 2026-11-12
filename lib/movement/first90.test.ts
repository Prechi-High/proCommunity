import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRST_90_START,
  daysBetween,
  first90,
  lagosISO,
  orientationEmbed,
  phaseForDay,
} from "./first90";

test("Day 1 is the Lagos start date itself, not UTC midnight", () => {
  assert.equal(FIRST_90_START, "2026-11-12");
  // 00:30 in Lagos on the start date is still the previous UTC date.
  const opening = first90(new Date("2026-11-11T23:30:00.000Z"));
  assert.equal(opening.today, "2026-11-12");
  assert.equal(opening.status, "during");
  assert.equal(opening.day, 1);
  assert.equal(opening.phase, "The Wake-Up");
  assert.equal(opening.progress, 1 / 90);

  // 23:30 UTC is already the next Lagos morning.
  const next = first90(new Date("2026-11-12T23:30:00.000Z"));
  assert.equal(next.today, "2026-11-13");
  assert.equal(next.day, 2);
});

test("phase names follow the First 90 calendar", () => {
  assert.equal(phaseForDay(7)?.name, "The Wake-Up");
  assert.equal(phaseForDay(8)?.name, "Contextless Buying");
  assert.equal(phaseForDay(22)?.name, "Become an Unmasker");
  assert.equal(phaseForDay(31)?.name, "Build the Timeline");
  assert.equal(phaseForDay(46)?.name, "Experience Becomes Intelligence");
  assert.equal(phaseForDay(56)?.name, "Seller Era");
  assert.equal(phaseForDay(66)?.name, "Something Is Coming");
  assert.equal(phaseForDay(71)?.name, "The next layer");
  assert.equal(phaseForDay(76)?.name, "Seller Audio Room Reveal");
  assert.equal(phaseForDay(81)?.name, "The Future of Buying");
  assert.equal(phaseForDay(86)?.name, "Final Countdown");
  assert.equal(phaseForDay(90)?.name, "The Next Layer");
  assert.equal(first90(new Date("2027-02-09T12:00:00.000Z")).status, "during");
  assert.equal(first90(new Date("2027-02-09T12:00:00.000Z")).day, 90);
});

test("after Day 90 the ceremony is complete and does not roll into a new day count", () => {
  const done = first90(new Date("2027-02-10T12:00:00.000Z"));
  assert.equal(done.status, "complete");
  assert.equal(done.day, 90);
  assert.equal(done.progress, 1);
  assert.match(done.line, /First 90 is complete/);
});

test("before the start date people are not shown a running countdown", () => {
  const early = first90(new Date("2026-11-11T12:00:00.000Z"));
  assert.equal(early.status, "before");
  assert.equal(early.day, 0);
  assert.equal(early.progress, 0);
});

test("Lagos date and day distance ignore the machine timezone", () => {
  assert.equal(lagosISO(new Date("2026-11-11T23:30:00.000Z")), "2026-11-12");
  assert.equal(daysBetween("2026-11-12", "2026-11-12"), 0);
  assert.equal(daysBetween("2026-11-20", "2026-11-12"), 8);
});

test("the orientation slot stays empty until a real url or id is configured", () => {
  assert.equal(orientationEmbed(""), null);
  assert.equal(orientationEmbed("   "), null);
  assert.equal(orientationEmbed("not a url"), null);
  const youtube = orientationEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(youtube?.kind, "iframe");
  assert.match(youtube && youtube.kind === "iframe" ? youtube.src : "", /dQw4w9WgXcQ/);
  const id = orientationEmbed("dQw4w9WgXcQ");
  assert.match(id && id.kind === "iframe" ? id.src : "", /youtube\.com\/embed\/dQw4w9WgXcQ/);
  const file = orientationEmbed("https://cdn.example.com/orientation.mp4");
  assert.equal(file?.kind, "file");
});
