import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getEnv } from "../../config/env.ts";
import { getDatabase } from "../../db/client.ts";
import { AdminSessionService } from "./auth.ts";

let service: AdminSessionService | undefined;

export function getAdminSessionService(): AdminSessionService {
  const env = getEnv();
  service ??= new AdminSessionService(
    getDatabase(),
    env.ADMIN_SESSION_SECRET,
    env.ADMIN_SESSION_TTL_HOURS,
  );
  return service;
}

export const getCurrentAdminSession = cache(async () => {
  const env = getEnv();
  const token = (await cookies()).get(env.ADMIN_SESSION_COOKIE_NAME)?.value;
  return getAdminSessionService().authenticate(token);
});

export async function requireAdminPageSession() {
  const session = await getCurrentAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
