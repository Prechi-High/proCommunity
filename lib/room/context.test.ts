import assert from "node:assert/strict";
import test from "node:test";

import { recordingCopy, roomProducts, roomTopic } from "./context";
import { arrangeRoom } from "./seats";

test("room products come from metadata and stay unique", () => {
  const chips = roomProducts({
    product_name: "Hydrating Cleanser",
    product_id: "cerave",
    product_brand: "CeraVe",
    products: [{ name: "Hydrating Cleanser" }, { name: "Daily Lotion", brand: "Sample" }],
    topic: "Texture in humidity",
  });
  assert.equal(chips.length, 2);
  assert.deepEqual(chips[0], { id: "cerave", name: "Hydrating Cleanser", brand: "CeraVe" });
  assert.equal(chips[1].name, "Daily Lotion");
  assert.equal(roomTopic({ topic: "Texture in humidity" }), "Texture in humidity");
});

test("recording copy stays honest about the session status", () => {
  assert.equal(recordingCopy("recording").active, true);
  assert.equal(recordingCopy("not_requested").label, "Not recording");
  assert.equal(recordingCopy("failed").failed, true);
});

test("stage holds host, co-hosts, and open mics; anonymous listeners stay off it", () => {
  const { stage, audience } = arrangeRoom({
    hostId: "host",
    hostName: "Ada",
    hostHandle: "ada",
    hostMark: "creator-ada",
    youId: "you",
    youName: "You",
    youRole: "listener",
    youMicOn: false,
    youAnonymous: false,
    cohostIds: ["co"],
    speakingIds: ["co"],
    people: [
      { id: "co", name: "Bea", micOn: false, speaking: true, creatorMark: "creator-bea" },
      { id: "mic", name: "Cal", micOn: true },
      { id: "listen", name: "Dee" },
      { id: "quiet", name: "Hidden", anonymous: true },
    ],
  });

  assert.deepEqual(stage.map((seat) => seat.role), ["host", "cohost", "speaker"]);
  assert.equal(stage[1].speaking, true);
  assert.deepEqual(audience.map((seat) => seat.name), ["You", "Dee"]);
  assert.equal(audience.some((seat) => seat.name === "Hidden"), false);
});

test("an approved speaker stays on stage while muted", () => {
  const { stage, audience } = arrangeRoom({
    hostId: "host",
    hostName: "Ada",
    youId: "you",
    youRole: "speaker",
    youMicOn: false,
    youAnonymous: false,
    cohostIds: [],
    speakingIds: [],
    speakerIds: ["you", "mic"],
    people: [{ id: "mic", name: "Cal", micOn: false }],
  });
  assert.deepEqual(stage.map((seat) => seat.name), ["Ada", "Cal", "You"]);
  assert.equal(audience.length, 0);
  assert.equal(stage.find((seat) => seat.name === "You")?.muted, true);
});

test("an anonymous listener is counted off stage", () => {
  const { stage, audience } = arrangeRoom({
    hostId: "host",
    hostName: "Ada",
    youId: "you",
    youRole: "listener",
    youMicOn: false,
    youAnonymous: true,
    cohostIds: [],
    speakingIds: [],
    people: [],
  });
  assert.equal(stage.length, 1);
  assert.equal(audience.length, 0);
});
