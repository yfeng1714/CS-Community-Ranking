import Link from "next/link";

import type { PastEventSummary } from "@/domain/event-mvp/service";
import { formatEventDate } from "@/domain/event-mvp/public-page";

import { PlayerPortrait } from "./player-portrait";

export function PastEventTable({ events }: { events: PastEventSummary[] }) {
  return (
    <section aria-labelledby="past-events-table-title" className="ranking-board">
      <div className="ranking-board__toolbar">
        <div>
          <span className="eyebrow">已结束</span>
          <h2 id="past-events-table-title">往期赛事 MVP</h2>
        </div>
      </div>

      <div className="ranking-table-wrap">
        <table className="ranking-table">
          <thead>
            <tr>
              <th scope="col">赛事</th>
              <th scope="col">候选</th>
              <th scope="col">社区 MVP</th>
              <th scope="col">票数</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.slug}>
                <td>
                  <Link className="ranking-player" href={`/past-events/${event.slug}`}>
                    <div className="ranking-player__portrait">
                      <PlayerPortrait nickname={event.name} photoUrl={null} variant="ranking" />
                    </div>
                    <span>
                      <strong>{event.name}</strong>
                      <small>
                        {formatEventDate(event.startsAt)} – {formatEventDate(event.endsAt)}
                      </small>
                    </span>
                  </Link>
                </td>
                <td>{event.candidateCount.toLocaleString("zh-CN")}</td>
                <td>
                  {event.mvpSlug && event.mvpNickname ? (
                    <Link className="ranking-player" href={`/player/${event.mvpSlug}`}>
                      <div className="ranking-player__portrait">
                        <PlayerPortrait
                          nickname={event.mvpNickname}
                          photoUrl={event.mvpPhotoUrl}
                          variant="ranking"
                        />
                      </div>
                      <span>
                        <strong>{event.mvpNickname}</strong>
                      </span>
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="ranking-table__score">{event.mvpVotes.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
