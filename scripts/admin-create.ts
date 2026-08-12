import { stdin, stdout } from "node:process";

import { closeDatabasePool, getDatabase } from "../src/db/client.ts";
import { createAdminUser } from "../src/domain/admin/auth.ts";

function parseUsername(): string {
  const argument = process.argv.slice(2).find((value) => value.startsWith("--username="));
  if (!argument) {
    throw new Error("Usage: pnpm admin:create -- --username=your-name");
  }
  return argument.slice("--username=".length);
}

async function readPassword(): Promise<string> {
  if (!stdin.isTTY) {
    let password = "";
    stdin.setEncoding("utf8");
    for await (const chunk of stdin) password += chunk;
    return password.replace(/[\r\n]+$/, "");
  }

  stdout.write("Password (input hidden): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let password = "";
  try {
    for await (const chunk of stdin) {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          stdout.write("\n");
          return password;
        }
        if (character === "\u0003") throw new Error("Admin creation cancelled");
        if (character === "\u007f") password = password.slice(0, -1);
        else password += character;
      }
    }
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
  return password;
}

const username = parseUsername();
const password = await readPassword();
try {
  const admin = await createAdminUser(getDatabase(), { password, username });
  stdout.write(`Created active admin ${admin.username} (ID ${admin.id}).\n`);
} finally {
  await closeDatabasePool();
}
