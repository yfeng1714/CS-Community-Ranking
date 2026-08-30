import type { Metadata } from "next";

import { EventMvpScreen } from "@/components/event-mvp-screen";
import { ProductPageView } from "@/components/analytics/page-view";
import { loadEventMvpBoard } from "@/domain/event-mvp/public-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "当期赛事 - BLAST S2",
  description: "CS 野榜 BLAST Open Porto 2026 社区 MVP。每天可为一名选手投 1 票。",
};

export default async function CurrentEventPage() {
  const board = await loadEventMvpBoard();

  return (
    <main className="public-page ranking-page" id="main-content">
      <ProductPageView event={{ eventType: "PAGE_VIEW", metadata: { page: "current-event" } }} />
      <EventMvpScreen
        board={board}
        candidateLabel="BLAST S2 候选"
        emptyTitle="当期赛事尚未开放"
        subtitle="每天可为一名选手投 1 票（+1）。当前赛事不影响社区总榜的+1/−1"
      />
    </main>
  );
}
