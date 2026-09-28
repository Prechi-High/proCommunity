// Generates the RSA-2048 key pair for the WhatsApp Flows data endpoint.
//   node scripts/whatsapp-flow-keys.mjs
// Writes .secrets/whatsapp-flow/private.pem (PKCS#8, unencrypted — required by WebCrypto)
// and public.pem (SPKI). .secrets/ is gitignored. Key contents are never printed.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".secrets", "whatsapp-flow");
const privatePath = join(dir, "private.pem");
const publicPath = join(dir, "public.pem");

if (existsSync(privatePath) && !process.argv.includes("--force")) {
  console.log(`Key pair already exists at ${dir}. Re-run with --force to rotate (then re-upload the public key to Meta).`);
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
writeFileSync(privatePath, privateKey, { mode: 0o600 });
writeFileSync(publicPath, publicKey);

console.log("Generated WhatsApp Flow key pair:");
console.log(`  private: ${privatePath}  → set as Supabase secret WHATSAPP_FLOW_PRIVATE_KEY`);
console.log(`  public:  ${publicPath}   → upload to Meta (POST /{PHONE_NUMBER_ID}/whatsapp_business_encryption)`);
console.log("Next: npx supabase secrets set --project-ref <ref> WHATSAPP_FLOW_PRIVATE_KEY=\"$(cat .secrets/whatsapp-flow/private.pem)\"");
