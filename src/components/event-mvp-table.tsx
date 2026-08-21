"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  compareEventMvpPlayers,
  withUniqueEventMvpRanks,
  type EventMvpPlayer,
} from "@/domain/event-mvp/service";

import { CountryFlag } from "./country-flag";
import { PlayerPortrait } from "./player-portrait";
import { SearchIcon } from "./icons";
import { TeamLogo } from "./team-logo";

function rating(value: number): string {
  return value.toFixed(2);
}

export function EventMvpTable({
  players,
  todayVoteSlug,
}: {
  players: EventMvpPlayer[];
  todayVoteSlug: string | null;
}) {
  const [query, setQuery] = useState("");
  const [votedSlug, setVotedSlug] = useState(todayVoteSlug);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState(players);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en");
    if (!normalized) return rows;
    return rows.filter((player) =>
      [player.nickname, player.team, player.teamShortName, player.country]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase("en").includes(normalized)),
    );
  }, [query, rows]);

  async function vote(slug: string) {
    if (votedSlug || pendingSlug) return;
    setPendingSlug(slug);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/event-mvp/votes", {
        body: JSON.stringify({ playerSlug: slug }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        alreadyVoted?: boolean;
        error?: { message?: string };
        playerSlug?: string;
        status?: string;
      };
      if (!response.ok) {
        setMessage(payload.error?.message ?? "投票暂时不可用");
        return;
      }
      const nextSlug = payload.playerSlug ?? slug;
      setVotedSlug(nextSlug);
      if (payload.alreadyVoted !== true && payload.status !== "SUSPICIOUS") {
        setRows((current) => {
          const next = current.map((player) =>
            player.slug === nextSlug ? { ...player, votes: player.votes + 1 } : player,
          );
          return withUniqueEventMvpRanks([...next].sort(compareEventMvpPlayers));
        });
      }
    } catch {
      setMessage("投票暂时不可用");
    } finally {
      setPendingSlug(null);
    }
  }

  return (
    <section aria-labelledby="event-mvp-table-title" className="ranking-board">
      <div className="ranking-board__toolbar">
        <div>
          <span className="eyebrow">EWC 候选</span>
          <h2 id="event-mvp-table-title">社区赛事 MVP</h2>
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

      <div className="ranking-table-wrap">
        <table className="ranking-table event-mvp-table">
          <thead>
            <tr>
              <th scope="col">排名</th>
              <th scope="col">选手</th>
              <th scope="col">票数</th>
              <th scope="col">赛事 Rating</th>
              <th scope="col">Maps</th>
              <th scope="col">战队</th>
              <th scope="col">投票</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player) => {
              const selected = votedSlug === player.slug;
              const disabled = Boolean(votedSlug) || pendingSlug !== null;
              return (
                <tr key={player.slug} data-voted={selected ? "true" : "false"}>
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
                  <td className="ranking-table__score">{player.votes.toLocaleString("zh-CN")}</td>
                  <td>{rating(player.eventRating)}</td>
                  <td>{player.maps ?? "—"}</td>
                  <td>
                    <span className="ranking-team">
                      {player.team ? <TeamLogo logoUrl={player.teamLogoUrl} size="small" /> : null}
                      {player.teamShortName ?? player.team ?? "—"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="event-mvp-vote"
                      disabled={disabled}
                      onClick={() => void vote(player.slug)}
                      type="button"
                    >
                      {selected ? "今日已投" : pendingSlug === player.slug ? "提交中" : "投票 +1"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {message ? <p className="event-mvp-message">{message}</p> : null}
      {votedSlug ? (
        <p className="event-mvp-message">今天的 1 票已记下。明天还可以再投 1 票。</p>
      ) : null}

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
