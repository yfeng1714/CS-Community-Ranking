import Link from "next/link";

import { EventMvpTable } from "@/components/event-mvp-table";
import type { EventMvpBoard } from "@/domain/event-mvp/service";
import { formatEventDate } from "@/domain/event-mvp/public-page";

export function EventMvpScreen({
  board,
  candidateLabel,
  emptyTitle,
  subtitle,
}: {
  board: EventMvpBoard;
  candidateLabel: string;
  emptyTitle: string;
  subtitle: string;
}) {
  return (
    <>
      <header className="page-hero page-hero--event">
        <div>
          <span className="eyebrow">{board.contest?.navLabel ?? "赛事"}</span>
          <h1>{board.contest?.name ?? emptyTitle}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="ranking-pulse">
          <span>候选选手</span>
          <strong>{board.players.length}</strong>
          <small>
            {board.contest
              ? `赛事 ${formatEventDate(board.contest.startsAt)} – ${formatEventDate(board.contest.endsAt)} · 投票截止 ${formatEventDate(board.contest.votingEndsAt)}`
              : "等待导入赛事名单"}
          </small>
        </div>
      </header>

      {board.contest ? (
        <EventMvpTable
          candidateLabel={candidateLabel}
          players={board.players}
          todayVoteSlug={board.todayVoteSlug}
          votingOpen={board.contest.votingOpen}
        />
      ) : (
        <section className="empty-state">
          <span className="eyebrow">准备中</span>
          <h2>{emptyTitle}</h2>
          <p>名单来自官方 HLTV 赛事 Rating，导入后会出现在这里。</p>
          <Link className="button button--primary" href="/ranking">
            查看社区榜
          </Link>
        </section>
      )}
    </>
  );
}
