import { cp, mkdir } from "node:fs/promises";

const source = "dist";
const output = "public";

await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true, force: true });

console.log("Prepared Vercel static output in public");
