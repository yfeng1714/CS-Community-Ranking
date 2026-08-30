import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EventMvpScreen } from "@/components/event-mvp-screen";
import { ProductPageView } from "@/components/analytics/page-view";
import { CURRENT_EVENT_MVP_PATH, CURRENT_EVENT_MVP_SLUG } from "@/domain/event-mvp/bundle";
import { loadEventMvpBoard } from "@/domain/event-mvp/public-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug === CURRENT_EVENT_MVP_SLUG) {
    return { title: "当期赛事" };
  }
  const board = await loadEventMvpBoard(slug);
  return board.contest
    ? { title: board.contest.name, description: `${board.contest.name} 社区 MVP 存档。` }
    : { title: "赛事未找到" };
}

export default async function PastEventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === CURRENT_EVENT_MVP_SLUG) {
    redirect(CURRENT_EVENT_MVP_PATH);
  }
  const board = await loadEventMvpBoard(slug);
  if (!board.contest) notFound();

  return (
    <main className="public-page ranking-page" id="main-content">
      <ProductPageView event={{ eventType: "PAGE_VIEW", metadata: { page: "past-events" } }} />
      <EventMvpScreen
        board={board}
        candidateLabel="往期候选"
        emptyTitle="没有这场往期赛事"
        subtitle="往期赛事社区 MVP。投票已结束，不影响社区总榜的+1/−1"
      />
    </main>
  );
}
