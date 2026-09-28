import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256Hex } from "../../core/crypto.ts";
import { buildSections } from "../sections.ts";
import { toPublicCard } from "../sharing.ts";
import { ResearchError } from "../types.ts";
import { PROFILE, uuid, world } from "../../__tests__/fakes.ts";

async function card(w: ReturnType<typeof world>, userId: string) {
  const c = await w.research.create({ userId, product: { productId: "cerave-foaming-cleanser", name: "Foaming Facial Cleanser", brand: "CeraVe" }, sourceChannel: "app" });
  await w.research.run(c.id);
  return c;
}

test("cards are created from the existing intelligence and get a public reference", async () => {
  const w = world();
  const userId = uuid();
  const c = await card(w, userId);
  assert.match(c.public_reference, /^SR-\d+$/);
  const view = await w.research.get(c.id, userId);
  assert.equal(view.card.title, "CeraVe Foaming Facial Cleanser");
  assert.ok(view.sections.some((s) => s.section_key === "community"));
  assert.ok(w.calls.some((x) => x.startsWith("get:")));
});

test("ownership: another user can't read, ask, compare, share, save or archive", async () => {
  const w = world();
  const c = await card(w, uuid());
  const other = uuid();
  for (const op of [
    () => w.research.get(c.id, other),
    () => w.research.askQuestion(c.id, other, "is it good?", "app"),
    () => w.research.compare(c.id, other, "Cetaphil"),
    () => w.research.share(c.id, other),
    () => w.research.save(c.id, other, "app"),
    () => w.research.archive(c.id, other),
  ]) {
    await assert.rejects(op(), (e: unknown) => e instanceof ResearchError && e.code === "RESEARCH_NOT_FOUND");
  }
  await assert.rejects(w.research.get("not-a-uuid", other), ResearchError);
});

test("sections without evidence are marked unavailable and never invented", () => {
  const built = buildSections({ identity: { name: "Mystery", category: "Gadgets" }, summary: "Something." }, "everything");
  const byKey = Object.fromEntries(built.sections.map((s) => [s.section_key, s.status]));
  assert.equal(byKey.summary, "ready");
  assert.equal(byKey.community, "unavailable");
  assert.equal(byKey.stores, "unavailable");
  assert.equal(built.status, "partial");
  assert.equal(buildSections(PROFILE, "everything").sections.find((s) => s.section_key === "ingredients_or_specs")?.title, "Ingredients");
});

test("sharing stores only a hash; the public projection strips fit and author names", async () => {
  const w = world();
  const userId = uuid();
  const c = await card(w, userId);
  const { url, token } = await w.research.share(c.id, userId);
  assert.ok(url.endsWith(`/r/${token}`));
  assert.equal(w.rr.shares[0].share_token_hash, await sha256Hex(token));
  assert.ok(!JSON.stringify(w.rr.shares).includes(token));

  const view = await w.research.get(c.id, userId);
  const raw = {
    reference: c.public_reference,
    title: view.card.title,
    status: view.card.status,
    sections: view.sections.map((s) => ({ key: s.section_key, title: s.title, content: s.content })),
    products: [],
    comparisons: [],
    sources: [],
  };
  const pub = toPublicCard(raw)!;
  assert.ok(!pub.sections.some((s) => s.key === "fit"));
  assert.ok(!JSON.stringify(pub).includes("jane_doe_private"));
  assert.ok(!JSON.stringify(pub).includes(userId));
});

test("revoking shares and archiving", async () => {
  const w = world();
  const userId = uuid();
  const c = await card(w, userId);
  await w.research.share(c.id, userId);
  assert.equal(await w.research.revokeShares(c.id, userId), 1);
  await w.research.archive(c.id, userId);
  await assert.rejects(w.research.get(c.id, userId), ResearchError);
});

test("questions and comparisons are stored on the card", async () => {
  const w = world({
    candidates: [{ productId: "cetaphil-gentle", name: "Gentle Skin Cleanser", brand: "Cetaphil", category: "Skincare", image: null, confidence: 0.9 }],
  });
  const userId = uuid();
  const c = await card(w, userId);
  const q = await w.research.askQuestion(c.id, userId, "Is it gentle?", "whatsapp");
  assert.equal(q.status, "answered");
  const cmp = await w.research.compare(c.id, userId, "Cetaphil Gentle Skin Cleanser");
  assert.equal(cmp.product_b_id, "cetaphil-gentle");
  const view = await w.research.get(c.id, userId);
  assert.equal(view.questions.length, 1);
  assert.equal(view.comparisons.length, 1);
});
