export type BrowserProductEvent =
  | { eventType: "NEXT_CLICK" | "VOTE_RESULT_VIEW"; metadata?: Record<string, never> }
  | {
      eventType: "PAGE_VIEW" | "RANKING_VIEW";
      metadata: { page: "about" | "ranking" | "vote" };
    }
  | { eventType: "PLAYER_VIEW"; metadata: { page: "player"; playerSlug: string } };

export function recordBrowserProductEvent(event: BrowserProductEvent): void {
  const body = JSON.stringify(event);
  if (navigator.sendBeacon) {
    const queued = navigator.sendBeacon(
      "/api/v1/events",
      new Blob([body], { type: "application/json" }),
    );
    if (queued) return;
  }
  void fetch("/api/v1/events", {
    body,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}
