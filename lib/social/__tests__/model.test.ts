import assert from "node:assert/strict";
import test from "node:test";

import {
  activeMoments,
  boardMoments,
  boardPosts,
  composeCard,
  expressionFromRow,
  momentFromRow,
  personUnseen,
  publicPhaseLabel,
  railFromMoments,
  sampleMark,
  splitSamples,
  type Moment,
} from "../model";

const media = { uri: "https://example.com/a.jpg" };

function moment(partial: Partial<Moment> & Pick<Moment, "id" | "authorId">): Moment {
  return {
    author: partial.authorId,
    handle: partial.authorId,
    avatar: null,
    media,
    mediaKind: "photo",
    caption: "",
    createdAt: "2026-11-12T08:00:00.000Z",
    expiresAt: "2026-11-13T08:00:00.000Z",
    sample: false,
    ...partial,
  };
}

test("stories older than a day leave the rail", () => {
  const now = Date.parse("2026-11-12T12:00:00.000Z");
  const rows = [
    moment({ id: "live", authorId: "a", expiresAt: "2026-11-13T08:00:00.000Z" }),
    moment({ id: "gone", authorId: "b", expiresAt: "2026-11-12T11:00:00.000Z" }),
  ];
  assert.deepEqual(activeMoments(rows, now).map((row) => row.id), ["live"]);
});

test("a real post is never marked as a sample", () => {
  const live = moment({ id: "real", authorId: "person" });
  const sample = moment({ id: "imagined", authorId: "sample-amaka", sample: true });
  const split = splitSamples([live, sample]);
  assert.equal(sampleMark(live), null);
  assert.equal(sampleMark(split.live[0]), null);
  assert.equal(sampleMark(split.samples[0]), "Sample");
  assert.equal(split.live.some((row) => row.sample), false);
});

test("sample stories fill the rail only when nobody has posted", () => {
  const live = moment({ id: "real", authorId: "person" });
  const sample = moment({ id: "imagined", authorId: "sample-amaka", sample: true });
  assert.deepEqual(boardMoments([live], [sample]).map((row) => row.id), ["real"]);
  assert.deepEqual(boardMoments([], [sample]).map((row) => row.id), ["imagined"]);
  assert.deepEqual(boardPosts([{ ...live, sample: false }], [{ ...sample, sample: true }]).map((row) => row.id), ["real"]);
});

test("one live moment keeps the person out of the sample rail", () => {
  const people = railFromMoments([
    moment({ id: "s", authorId: "a", sample: true }),
    moment({ id: "r", authorId: "a", sample: false }),
  ]);
  assert.equal(people.length, 1);
  assert.equal(people[0].sample, false);
  assert.equal(personUnseen(people[0], new Set(["s"])), true);
  assert.equal(personUnseen(people[0], new Set(["s", "r"])), false);
});

test("database rows are live records, not samples", () => {
  const story = momentFromRow(
    {
      id: "row",
      user_id: "user-1",
      media_kind: "photo",
      caption: "This is me.",
      attach_kind: "card",
      attach_id: "user-1",
      attach_label: "My Unmask",
      poll_prompt: null,
      poll_a: null,
      poll_b: null,
      created_at: "2026-11-12T08:00:00.000Z",
      expires_at: "2026-11-13T08:00:00.000Z",
    },
    { display_name: "Ada", handle: "ada", avatar_url: "https://example.com/ada.jpg" },
    "https://example.com/photo.jpg",
  );
  assert.equal(story.sample, false);
  assert.equal(story.author, "Ada");
  assert.equal(story.attach?.label, "My Unmask");
  const post = expressionFromRow(
    {
      id: "post",
      user_id: "user-1",
      media_kind: "photo",
      caption: "This is what I use.",
      product_id: null,
      journey_id: "journey-1",
      attach_card: false,
      attach_label: "Week 2",
      created_at: "2026-11-12T09:00:00.000Z",
    },
    { display_name: "Ada" },
    "https://example.com/post.jpg",
  );
  assert.equal(post.sample, false);
  assert.equal(post.attach?.kind, "timeline");
});

test("the public countdown does not name paused layers", () => {
  assert.equal(publicPhaseLabel("The Wake-Up"), "The Wake-Up");
  assert.equal(publicPhaseLabel("Ultra Unmask Reveal"), "The next layer");
  assert.equal(publicPhaseLabel("Seller Audio Room Reveal"), "The next layer");
});

test("a composed card belongs to the person and is not a sample", () => {
  const card = composeCard({
    userId: "user-1",
    name: " Ada ",
    handle: "ada",
    skin: "Dry",
    concerns: ["Texture", ""],
    products: [{ id: "p", name: "Cream" }],
  });
  assert.equal(card.sample, false);
  assert.equal(card.name, "Ada");
  assert.deepEqual(card.concerns, ["Texture"]);
});
