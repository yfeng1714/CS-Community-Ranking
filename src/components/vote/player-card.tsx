import Link from "next/link";

import type { BallotPlayerCard } from "@/domain/ballots/service";
import type { RankingResult, ResolutionChoice } from "@/domain/votes/presentation";

import { ChevronDownIcon } from "../icons";
import { PlayerPortrait } from "../player-portrait";
import { TeamLogo } from "../team-logo";

function metric(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

function freshness(value: string | null): string {
  if (!value) {
    return "数据待同步";
  }
  const capturedAt = new Date(value);
  const label = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(capturedAt);
  const stale = Date.now() - capturedAt.getTime() > 48 * 60 * 60 * 1_000;
  return stale ? `数据可能已过期 · 更新于 ${label}` : `数据更新于 ${label}`;
}

export function VotePlayerCard({
  choice,
  disabled,
  onChoose,
  player,
  position,
  ranking,
  resultChoice,
}: {
  choice: ResolutionChoice;
  disabled: boolean;
  onChoose(): void;
  player: BallotPlayerCard;
  position: "left" | "right";
  ranking?: RankingResult | undefined;
  resultChoice?: ResolutionChoice | undefined;
}) {
  const selected = resultChoice === choice;
  const resultVisible = resultChoice !== undefined;

  return (
    <article
      className="vote-card"
      data-position={position}
      data-result={resultVisible ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
    >
      {resultVisible ? (
        <div className="vote-card__main">
          <span className="vote-card__selection-label">
            {selected ? "你的选择" : resultChoice === "SKIP" ? "已跳过" : "本轮对手"}
          </span>
          <PlayerPortrait
            nickname={player.nickname}
            photoUrl={player.photoUrl}
            priority
            variant="vote"
          />
          <PlayerIdentity player={player} />
        </div>
      ) : (
        <button
          aria-keyshortcuts={position === "left" ? "1" : "2"}
          className="vote-card__main vote-card__choice"
          disabled={disabled}
          onClick={onChoose}
          type="button"
        >
          <span className="vote-card__selection-label">
            选择 {position === "left" ? "左" : "右"}
          </span>
          <PlayerPortrait
            nickname={player.nickname}
            photoUrl={player.photoUrl}
            priority
            variant="vote"
          />
          <PlayerIdentity player={player} />
        </button>
      )}

      <dl className="vote-card__stats" aria-label={`${player.nickname} 默认数据`}>
        <div>
          <dt>近三月 HLTV Rating</dt>
          <dd>{metric(player.recentRating)}</dd>
        </div>
        <div>
          <dt>地图数</dt>
          <dd>{player.recentMaps ?? "—"}</dd>
        </div>
        {ranking ? (
          <>
            <div>
              <dt>当前排名</dt>
              <dd>#{ranking.rank}</dd>
            </div>
            <div>
              <dt>社区分</dt>
              <dd>{ranking.score > 0 ? `+${ranking.score}` : ranking.score}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <details className="vote-card__details">
        <summary>
          详细数据
          <ChevronDownIcon />
        </summary>
        <dl>
          <div>
            <dt>生涯 HLTV Rating</dt>
            <dd>{metric(player.careerRating)}</dd>
          </div>
          <div>
            <dt>ADR</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>KAST</dt>
            <dd>—</dd>
          </div>
        </dl>
        <p>{freshness(player.statsCapturedAt)}</p>
        {resultVisible ? <Link href={`/player/${player.slug}`}>查看选手页</Link> : null}
      </details>
    </article>
  );
}

function PlayerIdentity({ player }: { player: BallotPlayerCard }) {
  return (
    <div className="vote-card__identity">
      <h2>{player.nickname}</h2>
      <p>
        <span className="team-inline">
          {player.team ? <TeamLogo logoUrl={player.teamLogoUrl} size="small" /> : null}
          {player.team ?? "暂无战队"}
        </span>
        <span aria-hidden="true">·</span>
        <span>{player.country ?? "国籍待补"}</span>
      </p>
    </div>
  );
}
