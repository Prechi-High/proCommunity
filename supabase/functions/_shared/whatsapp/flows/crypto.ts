import { base64ToBytes, bytesToBase64 } from "../../core/crypto.ts";

/**
 * WhatsApp Flows data-channel encryption (WebCrypto; runs in Deno and Node):
 *  - request AES-128 key is RSA-OAEP(SHA-256) encrypted with our public key
 *  - flow data is AES-128-GCM with the 16-byte tag appended
 *  - the response is encrypted with the same key and the bit-flipped IV
 * The private key must be an unencrypted PKCS#8 PEM ("BEGIN PRIVATE KEY"); see scripts/whatsapp-flow-keys.mjs.
 */

export class FlowCryptoError extends Error {
  constructor(
    readonly status: 421 | 400,
    message: string,
  ) {
    super(message);
  }
}

export type EncryptedFlowRequest = { encrypted_aes_key: string; encrypted_flow_data: string; initial_vector: string };
export type DecryptedFlow = { body: Record<string, unknown>; aesKey: CryptoKey; iv: Uint8Array };

function pemToDer(pem: string): Uint8Array {
  const clean = pem.replace(/\\n/g, "\n");
  if (/BEGIN (RSA |ENCRYPTED )PRIVATE KEY/.test(clean)) throw new FlowCryptoError(421, "private key must be unencrypted PKCS#8");
  return base64ToBytes(clean.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey("pkcs8", pemToDer(pem), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  } catch (err) {
    if (err instanceof FlowCryptoError) throw err;
    throw new FlowCryptoError(421, "invalid private key");
  }
}

export async function decryptFlowRequest(body: EncryptedFlowRequest, privateKey: CryptoKey): Promise<DecryptedFlow> {
  if (!body?.encrypted_aes_key || !body.encrypted_flow_data || !body.initial_vector) throw new FlowCryptoError(400, "malformed request");
  let rawKey: ArrayBuffer;
  try {
    rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, base64ToBytes(body.encrypted_aes_key));
  } catch {
    // 421 tells the WhatsApp client to re-fetch our public key and retry.
    throw new FlowCryptoError(421, "aes key decryption failed");
  }
  const iv = base64ToBytes(body.initial_vector);
  const aesKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, base64ToBytes(body.encrypted_flow_data));
  } catch {
    throw new FlowCryptoError(421, "flow data decryption failed");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new FlowCryptoError(400, "flow data is not JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new FlowCryptoError(400, "flow data is not an object");
  return { body: parsed as Record<string, unknown>, aesKey, iv };
}

export async function encryptFlowResponse(response: unknown, aesKey: CryptoKey, iv: Uint8Array): Promise<string> {
  const flipped = iv.map((b) => ~b & 0xff);
  const data = new TextEncoder().encode(JSON.stringify(response));
  const out = await crypto.subtle.encrypt({ name: "AES-GCM", iv: flipped, tagLength: 128 }, aesKey, data);
  return bytesToBase64(new Uint8Array(out));
}
