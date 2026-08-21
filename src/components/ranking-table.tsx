"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { RankingSortDirection } from "@/domain/public/presentation";
import type { PublicRankingPlayer } from "@/domain/public/types";

import { CountryFlag } from "./country-flag";
import { SearchIcon } from "./icons";
import { PlayerPortrait } from "./player-portrait";
import { TeamLogo } from "./team-logo";

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function score(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function RankingTable({ players }: { players: PublicRankingPlayer[] }) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<RankingSortDirection>("desc");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en");
    const matched = !normalized
      ? players
      : players.filter((player) =>
          [player.nickname, player.team, player.teamShortName, player.country]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLocaleLowerCase("en").includes(normalized)),
        );
    return direction === "asc" ? [...matched].reverse() : matched;
  }, [direction, players, query]);

  return (
    <section aria-labelledby="ranking-table-title" className="ranking-board">
      <div className="ranking-board__toolbar">
        <div>
          <span className="eyebrow">全体候选</span>
          <h2 id="ranking-table-title">社区实时排名</h2>
        </div>
        <div className="ranking-board__controls">
          <div className="ranking-sort" role="group" aria-label="分数排序方向">
            <button
              aria-pressed={direction === "desc"}
              onClick={() => setDirection("desc")}
              type="button"
            >
              高分在前
            </button>
            <button
              aria-pressed={direction === "asc"}
              onClick={() => setDirection("asc")}
              type="button"
            >
              低分在前
            </button>
          </div>
          <label className="ranking-search">
            <SearchIcon />
            <span className="sr-only">搜索选手或战队</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索选手或战队"
              type="search"
              value={query}
            />
          </label>
        </div>
      </div>

      <div className="ranking-table-wrap">
        <table className="ranking-table">
          <thead>
            <tr>
              <th scope="col">排名</th>
              <th scope="col">选手</th>
              <th scope="col">分数</th>
              <th scope="col">战队</th>
              <th scope="col">胜 / 负</th>
              <th scope="col">胜率</th>
              <th scope="col">有效对决</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player) => (
              <tr key={player.slug}>
                <td className="ranking-table__rank">#{player.rank}</td>
                <td>
                  <Link className="ranking-player" href={`/player/${player.slug}`}>
                    <div className="ranking-player__portrait">
                      <PlayerPortrait
                        nickname={player.nickname}
                        photoUrl={player.photoUrl}
                        variant="ranking"
                      />
                    </div>
                    <span>
                      <strong>{player.nickname}</strong>
                      <small>
                        <CountryFlag code={player.country} missingLabel="—" />
                      </small>
                    </span>
                  </Link>
                </td>
                <td className="ranking-table__score" data-positive={player.score > 0}>
                  {score(player.score)}
                </td>
                <td>
                  <span className="ranking-team">
                    {player.team ? <TeamLogo logoUrl={player.teamLogoUrl} size="small" /> : null}
                    {player.teamShortName ?? player.team ?? "—"}
                  </span>
                </td>
                <td>
                  {player.wins.toLocaleString("zh-CN")} / {player.losses.toLocaleString("zh-CN")}
                </td>
                <td>{percent(player.winRate)}</td>
                <td>{player.decisions.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <div className="ranking-empty">
          <p>没有找到匹配的选手。</p>
          <button onClick={() => setQuery("")} type="button">
            清除搜索
          </button>
        </div>
      ) : null}
    </section>
  );
}
