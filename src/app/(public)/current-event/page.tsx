import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { EventMvpTable } from "@/components/event-mvp-table";
import { ProductPageView } from "@/components/analytics/page-view";
import { getEnv } from "@/config/env";
import { getDatabase } from "@/db/client";
import { EventMvpService } from "@/domain/event-mvp/service";
import { VisitorIdentityService } from "@/domain/visitors/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "当期赛事 - EWC",
  description: "CS 野榜 Esports World Cup 2026 社区 MVP。每天可为一名选手投 1 票。",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

export default async function CurrentEventPage() {
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
  const board = await new EventMvpService(database, {
    riskEnforcementMode: env.RISK_ENFORCEMENT_MODE,
    timeZone: env.APP_TIME_ZONE,
  }).getBoard(visitorId);

  return (
    <main className="public-page ranking-page" id="main-content">
      <ProductPageView event={{ eventType: "PAGE_VIEW", metadata: { page: "current-event" } }} />
      <header className="page-hero page-hero--ranking">
        <div>
          <span className="eyebrow">{board.contest?.navLabel ?? "当期赛事"}</span>
          <h1>{board.contest?.name ?? "当期赛事尚未开放"}</h1>
          <p>
            每天可为一名选手投 1 票（+1）。这不影响社区榜的 +1/−1。同分先看票数，再看 HLTV 本赛事
            Rating 3.0。
          </p>
        </div>
        <div className="ranking-pulse">
          <span>候选选手</span>
          <strong>{board.players.length}</strong>
          <small>
            {board.contest
              ? `${formatDate(board.contest.startsAt)} – ${formatDate(board.contest.endsAt)}`
              : "等待导入赛事名单"}
          </small>
        </div>
      </header>

      {board.contest ? (
        <EventMvpTable players={board.players} todayVoteSlug={board.todayVoteSlug} />
      ) : (
        <section className="empty-state">
          <span className="eyebrow">准备中</span>
          <h2>当前没有开放的赛事投票</h2>
          <p>名单来自官方 HLTV 赛事 Rating，导入后会出现在这里。</p>
          <Link className="button button--primary" href="/ranking">
            查看社区榜
          </Link>
        </section>
      )}
    </main>
  );
}
