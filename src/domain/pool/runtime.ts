import { getEnv } from "../../config/env.ts";
import { getDatabase } from "../../db/client.ts";
import { ActivePoolCache } from "./active-pool-cache.ts";
import { CandidatePoolService } from "./service.ts";

let service: CandidatePoolService | undefined;

export function getRuntimeCandidatePoolService(): CandidatePoolService {
  if (!service) {
    service = new CandidatePoolService(
      getDatabase(),
      new ActivePoolCache(getEnv().ACTIVE_POOL_CACHE_TTL_SECONDS * 1_000),
    );
  }

  return service;
}
