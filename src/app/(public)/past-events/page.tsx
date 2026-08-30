import type { Metadata } from "next";
import Link from "next/link";

import { PastEventTable } from "@/components/past-event-table";
import { ProductPageView } from "@/components/analytics/page-view";
import { loadPastEvents } from "@/domain/event-mvp/public-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "往期赛事",
  description: "CS 野榜往期赛事社区 MVP 存档。",
};

export default async function PastEventsPage() {
  const events = await loadPastEvents();

  return (
    <main className="public-page ranking-page" id="main-content">
      <ProductPageView event={{ eventType: "PAGE_VIEW", metadata: { page: "past-events" } }} />
      <header className="page-hero page-hero--ranking">
        <div>
          <span className="eyebrow">往期赛事</span>
          <h1>往期赛事</h1>
          <p>已结束的赛事 MVP 仍可查阅，不再接受新票。点进某一届即可看到当时的完整榜单。</p>
        </div>
        <div className="ranking-pulse">
          <span>存档赛事</span>
          <strong>{events.length}</strong>
          <small>投票已结束的社区 MVP</small>
        </div>
      </header>

      {events.length > 0 ? (
        <PastEventTable events={events} />
      ) : (
        <section className="empty-state">
          <span className="eyebrow">准备中</span>
          <h2>还没有往期赛事</h2>
          <p>当期赛事结束后会归档到这里。</p>
          <Link className="button button--primary" href="/current-event">
            查看当期赛事
          </Link>
        </section>
      )}
    </main>
  );
}
