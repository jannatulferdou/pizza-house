import { cp, mkdir, writeFile } from "node:fs/promises";
import { vercelConfig } from "./vercel-config.mjs";

// Vercel's Build Output API supports environment-specific external rewrites.
// Keep browser requests on the frontend origin so HttpOnly session cookies work.
const config = vercelConfig(process.env.API_ORIGIN);
const output = new URL("../.vercel/output/", import.meta.url);
await mkdir(output, { recursive: true });
await cp(new URL("../dist/", import.meta.url), new URL("static/", output), { recursive: true });
await writeFile(new URL("config.json", output), JSON.stringify(config, null, 2) + "\n");
console.log("Vercel output created with API proxy to", new URL(process.env.API_ORIGIN).origin);
