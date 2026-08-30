import { cookies } from "next/headers";

import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";
import { CURRENT_EVENT_MVP_SLUG } from "@/domain/event-mvp/bundle";
import { EventMvpService } from "@/domain/event-mvp/service";
import { VisitorIdentityService } from "@/domain/visitors/service";

export async function loadEventMvpBoard(slug = CURRENT_EVENT_MVP_SLUG) {
  const env = getEnv();
  const database = getDatabase();
  const cookieStore = await cookies();
  let visitorId: bigint | null = null;
  try {
    const visitor = await new VisitorIdentityService(database, env.VISITOR_TOKEN_HASH_PEPPER).find(
      cookieStore.get(env.VISITOR_COOKIE_NAME)?.value,
    );
    visitorId = visitor?.id ?? null;
  } catch {
    visitorId = null;
  }
  return new EventMvpService(database, {
    riskEnforcementMode: env.RISK_ENFORCEMENT_MODE,
    timeZone: env.APP_TIME_ZONE,
  }).getBoard(visitorId, slug);
}

export async function loadPastEvents() {
  const env = getEnv();
  return new EventMvpService(getDatabase(), {
    riskEnforcementMode: env.RISK_ENFORCEMENT_MODE,
    timeZone: env.APP_TIME_ZONE,
  }).listPastEvents();
}

export function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${value}T00:00:00+08:00`));
}
