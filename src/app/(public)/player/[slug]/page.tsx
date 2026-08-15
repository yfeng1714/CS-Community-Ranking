import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRightIcon } from "@/components/icons";
import { ProductPageView } from "@/components/analytics/page-view";
import { PlayerPortrait } from "@/components/player-portrait";
import { TeamLogo } from "@/components/team-logo";
import { getDatabase } from "@/db/client";
import { getEnv } from "@/config/env";
import { getPublicPlayer } from "@/domain/public/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPublicPlayer(
    getDatabase(),
    slug,
    new Date(),
    getEnv().EXTERNAL_STATS_STALE_AFTER_HOURS,
  );
  return player
    ? { title: player.nickname, description: `${player.nickname} 的 CS 野榜社区排名与数据。` }
    : { title: "选手未找到" };
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatMetric(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await getPublicPlayer(
    getDatabase(),
    slug,
    new Date(),
    getEnv().EXTERNAL_STATS_STALE_AFTER_HOURS,
  );
  if (!player) {
    notFound();
  }

  return (
    <main className="public-page player-page" id="main-content">
      <ProductPageView
        event={{ eventType: "PLAYER_VIEW", metadata: { page: "player", playerSlug: slug } }}
      />
      <Link className="back-link" href="/ranking">
        ← 返回榜单
      </Link>
      <section className="player-profile">
        <div className="player-profile__portrait">
          <PlayerPortrait
            nickname={player.nickname}
            photoUrl={player.photoUrl}
            priority
            variant="profile"
          />
        </div>
        <div className="player-profile__identity">
          <span className="eyebrow">
            {player.professionalStatus === "ACTIVE" ? "现役选手" : "当前未参与新对决"}
          </span>
          <h1>{player.nickname}</h1>
          <p className="player-profile__real-name">{player.realName ?? "真实姓名待补充"}</p>
          <div className="player-profile__meta">
            <span className="player-profile__team">
              {player.team ? <TeamLogo logoUrl={player.teamLogoUrl} /> : null}
              {player.team ?? "暂无战队"}
            </span>
            <span>{player.country ?? "国籍待补"}</span>
          </div>
        </div>
        <div className="player-profile__rank">
          <span>社区排名</span>
          <strong>{player.ranking ? `#${player.ranking.rank}` : "—"}</strong>
          <small>
            {player.ranking
              ? `${player.ranking.score > 0 ? "+" : ""}${player.ranking.score} 分`
              : "当前 Edition 未入榜"}
          </small>
        </div>
      </section>

      <section className="player-dashboard" aria-label={`${player.nickname} 社区榜数据`}>
        <article className="metric-card metric-card--accent">
          <span>胜率</span>
          <strong>{formatPercent(player.ranking?.winRate ?? null)}</strong>
          <small>Skip 不进入胜率分母</small>
        </article>
        <article className="metric-card">
          <span>胜 / 负</span>
          <strong>
            {player.ranking?.wins ?? 0} / {player.ranking?.losses ?? 0}
          </strong>
          <small>{player.ranking?.decisions ?? 0} 次有效对决</small>
        </article>
        <article className="metric-card">
          <span>被跳过</span>
          <strong>{player.ranking?.skips ?? 0}</strong>
          <small>双方均记录一次 Skip 出场</small>
        </article>
      </section>

      <section className="player-data-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">外部竞技数据</span>
            <h2>近期表现</h2>
          </div>
          <span className="freshness-badge" data-status={player.freshness.toLowerCase()}>
            {player.freshness === "MISSING"
              ? "数据待同步"
              : player.freshness === "STALE"
                ? "数据可能已过期"
                : "数据已更新"}
          </span>
        </div>
        <div className="player-data-grid">
          <article>
            <span>近三月 HLTV Rating</span>
            <strong>{formatMetric(player.recentRating)}</strong>
          </article>
          <article>
            <span>统计地图</span>
            <strong>{player.recentMaps ?? "—"}</strong>
          </article>
          <article>
            <span>生涯 HLTV Rating</span>
            <strong>{formatMetric(player.careerRating)}</strong>
          </article>
        </div>
        <p className="data-note">
          {player.statsCapturedAt
            ? `最近抓取：${new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeZone: "Asia/Shanghai" }).format(new Date(player.statsCapturedAt))}`
            : "尚无经过审核的外部数据。缺失值显示为“—”。"}
        </p>
        {player.hltvProfileUrl && (
          <p className="data-note">
            <a href={player.hltvProfileUrl} rel="noopener noreferrer" target="_blank">
              在 HLTV 查看选手资料 ↗
            </a>
          </p>
        )}
      </section>

      <Link className="player-page__vote-cta" href="/">
        回到随机对决
        <ArrowRightIcon />
      </Link>
    </main>
  );
}
