import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";

import { PublicRiskMonitor } from "./risk-monitor";

let publicRiskMonitor: PublicRiskMonitor | undefined;

export function getPublicRiskMonitor(): PublicRiskMonitor {
  if (!publicRiskMonitor) {
    const env = getEnv();
    publicRiskMonitor = new PublicRiskMonitor(getDatabase(), {
      clientIpMode: env.CLIENT_IP_MODE,
      invalidOwnershipThreshold: env.RISK_INVALID_OWNERSHIP_PER_IP_PER_DAY,
      impossibleFlowThreshold: env.RISK_IMPOSSIBLE_CLIENT_FLOW_PER_IP_PER_DAY,
      ipHmacSecret: env.IP_HMAC_SECRET,
      maximumKeys: env.RATE_LIMITER_MAX_KEYS,
      newVisitorThreshold: env.RISK_NEW_VISITORS_PER_IP_PER_DAY,
      publicApiLimit: env.PUBLIC_API_RATE_LIMIT_PER_MINUTE,
      replayMismatchThreshold: env.RISK_REPLAY_MISMATCH_PER_IP_PER_DAY,
      requestVelocityThreshold: env.RISK_REQUEST_VELOCITY_PER_MINUTE,
      timeZone: env.APP_TIME_ZONE,
      trustProxyHeaders: env.TRUST_PROXY_HEADERS,
    });
  }
  return publicRiskMonitor;
}
