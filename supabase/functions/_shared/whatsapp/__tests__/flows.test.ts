import assert from "node:assert/strict";
import { constants, generateKeyPairSync, publicEncrypt, randomBytes, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "../../core/crypto.ts";
import { decryptFlowRequest, encryptFlowResponse, FlowCryptoError, importPrivateKey } from "../flows/crypto.ts";
import { handleFlowRequest, launchResearchFlow } from "../flows/handler.ts";
import { linkedUser, uuid, world } from "../../__tests__/fakes.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

/** Simulates the WhatsApp client: encrypts a request exactly as Meta documents it. */
async function metaEncrypt(payload: unknown) {
  const aes = randomBytes(16);
  const iv = randomBytes(16);
  const key = await webcrypto.subtle.importKey("raw", aes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const data = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, new TextEncoder().encode(JSON.stringify(payload)));
  return {
    body: {
      encrypted_aes_key: publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, aes).toString("base64"),
      encrypted_flow_data: Buffer.from(data).toString("base64"),
      initial_vector: iv.toString("base64"),
    },
    key,
    iv,
  };
}

async function metaDecryptResponse(b64: string, key: webcrypto.CryptoKey, iv: Buffer) {
  const flipped = Buffer.from(iv.map((b) => ~b & 0xff));
  const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: flipped, tagLength: 128 }, key, Buffer.from(b64, "base64"));
  return JSON.parse(new TextDecoder().decode(plain));
}

test("flow crypto round trip: decrypt request, encrypt response with the flipped IV", async () => {
  const pk = await importPrivateKey(privateKey);
  const req = await metaEncrypt({ version: "3.0", action: "ping" });
  const dec = await decryptFlowRequest(req.body, pk);
  assert.deepEqual(dec.body, { version: "3.0", action: "ping" });
  const out = await encryptFlowResponse({ data: { status: "active" } }, dec.aesKey, dec.iv);
  assert.deepEqual(await metaDecryptResponse(out, req.key, req.iv), { data: { status: "active" } });
});

test("flow crypto: wrong key yields 421 so WhatsApp refreshes the public key", async () => {
  const other = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const req = await metaEncrypt({ action: "ping" });
  await assert.rejects(decryptFlowRequest(req.body, await importPrivateKey(other.privateKey)), (e: unknown) => e instanceof FlowCryptoError && e.status === 421);
  await assert.rejects(decryptFlowRequest({ ...req.body, encrypted_flow_data: Buffer.from("tampered-data-xx").toString("base64") }, await importPrivateKey(privateKey)), FlowCryptoError);
});

test("flow crypto: encrypted (PKCS#1/passphrase) keys are rejected with a clear error", async () => {
  await assert.rejects(importPrivateKey("-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----"), /PKCS#8/);
});

async function session(w: ReturnType<typeof world>, mode: "HOME" | "OPEN_RESEARCH" | "MY_RESEARCH" | "START_RESEARCH", cardId?: string) {
  const { userId, conn } = await linkedUser(w, uuid(), `23480${Math.floor(Math.random() * 1e8)}`);
  await launchResearchFlow({ repo: w.wa.repo, client: w.client, flowId: "FLOW1" }, conn, mode, cardId);
  const flowToken = (w.sent.at(-1)?.payload as { flowToken: string }).flowToken;
  return { userId, conn, flowToken };
}

test("flow launch stores only a hash of the flow_token", async () => {
  const w = world();
  const { flowToken } = await session(w, "HOME");
  assert.match(flowToken, /^ft_/);
  assert.equal(w.wa.flowSessions[0].token_hash, await sha256Hex(flowToken));
  assert.ok(!JSON.stringify(w.wa.flowSessions).includes(flowToken));
});

test("flow INIT resolves the user from the flow_token and shows their research", async () => {
  const w = world();
  const { userId, flowToken } = await session(w, "HOME");
  await w.research.create({ userId, product: { productId: "p1", name: "Dyson Airwrap" }, sourceChannel: "app" });
  const res = await handleFlowRequest({ version: "3.0", action: "INIT", flow_token: flowToken }, { repo: w.wa.repo, research: w.research });
  assert.equal(res.screen, "HOME");
  assert.equal(res.data.has_recent, true);
  assert.equal((res.data.recent as Array<{ title: string }>)[0].title, "Dyson Airwrap");
});

test("flow IDOR: a card id from another account in the payload is refused", async () => {
  const w = world();
  const victim = await w.research.create({ userId: uuid(), product: { productId: "p1", name: "Secret product" }, sourceChannel: "app" });
  const { flowToken } = await session(w, "HOME");
  const res = await handleFlowRequest({ action: "data_exchange", screen: "HOME", flow_token: flowToken, data: { cmd: "open", card_id: victim.id } }, { repo: w.wa.repo, research: w.research });
  assert.equal(res.screen, "ERROR");
  assert.ok(!JSON.stringify(res).includes("Secret product"));
});

test("flow: unknown or expired flow tokens and disconnected numbers get the error screen", async () => {
  const w = world();
  const bad = await handleFlowRequest({ action: "INIT", flow_token: "ft_forged" }, { repo: w.wa.repo, research: w.research });
  assert.equal(bad.screen, "ERROR");
  const { conn, flowToken } = await session(w, "HOME");
  await w.wa.repo.disconnect({ waId: conn.wa_id });
  const after = await handleFlowRequest({ action: "INIT", flow_token: flowToken }, { repo: w.wa.repo, research: w.research });
  assert.equal(after.screen, "ERROR");
});

test("flow: open → overview → section for the owner's card, and start research queues a job", async () => {
  const w = world();
  const { userId, flowToken } = await session(w, "HOME");
  const card = await w.research.create({ userId, product: { productId: "cerave-foaming-cleanser", name: "Foaming Facial Cleanser", brand: "CeraVe" }, sourceChannel: "whatsapp" });
  await w.research.run(card.id);
  const deps = { repo: w.wa.repo, research: w.research };
  const overview = await handleFlowRequest({ action: "data_exchange", flow_token: flowToken, data: { cmd: "open", card_id: card.id } }, deps);
  assert.equal(overview.screen, "OVERVIEW");
  assert.equal(overview.data.card_id, card.id);
  const section = await handleFlowRequest({ action: "data_exchange", flow_token: flowToken, data: { cmd: "section", card_id: card.id, section: "community" } }, deps);
  assert.equal(section.screen, "SECTION");
  assert.match(String(section.data.body), /Doesn't strip my skin/);
  const start = await handleFlowRequest({ action: "data_exchange", flow_token: flowToken, data: { cmd: "research", query: "Dyson Airwrap", focus: "price" } }, deps);
  assert.equal(start.screen, "DONE");
  assert.equal(w.wa.jobs.at(-1)?.kind, "research_text");
  assert.equal(w.wa.jobs.at(-1)?.payload.userId, userId);
});

test("flow ping and the Flow JSON declare every screen the handler returns", async () => {
  const w = world();
  assert.deepEqual(await handleFlowRequest({ action: "ping" }, { repo: w.wa.repo, research: w.research }), { data: { status: "active" } });
  const flow = JSON.parse(readFileSync(fileURLToPath(new URL("../flows/research-flow.json", import.meta.url)), "utf8")) as { screens: Array<{ id: string; data: Record<string, unknown> }>; routing_model: Record<string, string[]> };
  const ids = flow.screens.map((s) => s.id);
  for (const s of ["HOME", "START_RESEARCH", "MY_RESEARCH", "OVERVIEW", "SECTION", "DONE", "ERROR"]) assert.ok(ids.includes(s), s);
  for (const [from, to] of Object.entries(flow.routing_model)) for (const t of to) assert.ok(ids.includes(t), `${from}→${t}`);
});
