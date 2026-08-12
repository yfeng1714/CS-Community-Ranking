import type { Metadata } from "next";
import Link from "next/link";

import { RankingTable } from "@/components/ranking-table";
import { ProductPageView } from "@/components/analytics/page-view";
import { getDatabase } from "@/db/client";
import { getPublicRanking } from "@/domain/public/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "社区榜单",
  description: "CS 野榜实时社区职业选手排名。相同分数共享相同排名。",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "尚无排名变化";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export default async function RankingPage() {
  const ranking = await getPublicRanking(getDatabase());

  return (
    <main className="public-page ranking-page" id="main-content">
      <ProductPageView event={{ eventType: "RANKING_VIEW", metadata: { page: "ranking" } }} />
      <header className="page-hero page-hero--ranking">
        <div>
          <span className="eyebrow">
            {ranking.edition ? `${ranking.edition.code} Edition` : "Edition 暂未开放"}
          </span>
          <h1>社区榜单</h1>
          <p>每张有效票，胜者 +1，败者 -1。相同分数，共享同一排名。</p>
        </div>
        <div className="ranking-pulse">
          <span>入榜选手</span>
          <strong>{ranking.players.length}</strong>
          <small>更新：{formatDate(ranking.updatedAt)}</small>
        </div>
      </header>

      {ranking.edition ? (
        <RankingTable players={ranking.players} />
      ) : (
        <section className="empty-state">
          <span className="eyebrow">准备中</span>
          <h2>当前没有开放的 Edition</h2>
          <p>历史数据不会被删除；新一期开放后，这里会显示完整候选池。</p>
          <Link className="button button--primary" href="/about">
            了解榜单规则
          </Link>
        </section>
      )}
    </main>
  );
}
