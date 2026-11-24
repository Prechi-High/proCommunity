import { cp, mkdir } from "node:fs/promises";

const source = "dist";
const target = "public";

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
console.log("Prepared Vercel static output in public");
