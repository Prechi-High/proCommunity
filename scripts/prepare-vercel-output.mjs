import { cp, mkdir, writeFile } from "node:fs/promises";

const source = "dist";
const output = ".vercel/output";
const target = `${output}/static`;

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });

await writeFile(
  `${output}/config.json`,
  JSON.stringify({ version: 3 }, null, 2) + "\n",
  "utf8",
);

console.log("Prepared Vercel Build Output API static output in .vercel/output/static");
