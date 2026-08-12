import type { IssuedBallotResponse } from "@/domain/ballots/service";
import type { ResolutionChoice, ResolutionResponse } from "@/domain/votes/presentation";

interface ErrorPayload {
  error?: { code?: unknown; message?: unknown; originalChoice?: unknown };
}

export class PublicApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as ErrorPayload).error
        : undefined;
    throw new PublicApiError(
      typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
      typeof error?.message === "string" ? error.message : "请求暂时失败，请稍后再试。",
      response.status,
    );
  }
  return payload as T;
}

export interface VotingApi {
  next(): Promise<IssuedBallotResponse>;
  resolve(publicBallotId: string, choice: ResolutionChoice): Promise<ResolutionResponse>;
}

export const browserVotingApi: VotingApi = {
  async next() {
    return parseResponse<IssuedBallotResponse>(
      await fetch("/api/v1/ballots/next", {
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
  },
  async resolve(publicBallotId, choice) {
    return parseResponse<ResolutionResponse>(
      await fetch(`/api/v1/ballots/${encodeURIComponent(publicBallotId)}/resolve`, {
        body: JSON.stringify({ choice }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
  },
};
