import { registerHooks } from "node:module";
import { existsSync } from "node:fs";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = new URL(specifier.slice(2), sourceRoot);
      const candidates = [new URL(`${target.href}.ts`), new URL(`${target.href}/index.ts`), target];
      const resolved = candidates.find((candidate) => existsSync(candidate));
      return nextResolve((resolved ?? target).href, context);
    }

    return nextResolve(specifier, context);
  },
});
