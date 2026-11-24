import { cp, mkdir, writeFile } from "node:fs/promises";

const source = "dist";
const target = ".vercel/output/static";

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
await writeFile(".vercel/output/config.json", JSON.stringify({ version: 3 }, null, 2) + "\n");
console.log("Prepared Vercel Build Output API in .vercel/output");
