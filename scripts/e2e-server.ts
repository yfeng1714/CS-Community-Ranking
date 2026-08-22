import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const standaloneRoot = path.resolve(".next/standalone");
await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await cp(path.resolve("public"), path.join(standaloneRoot, "public"), { recursive: true });
await cp(path.resolve(".next/static"), path.join(standaloneRoot, ".next/static"), {
  recursive: true,
});

await import(pathToFileURL(path.join(standaloneRoot, "server.js")).href);
