export function PlayerHonors({
  majorsWon,
  mvpCount,
}: {
  majorsWon: number | null;
  mvpCount: number | null;
}) {
  if (majorsWon === null && mvpCount === null) {
    return null;
  }

  return (
    <ul className="player-honors" aria-label="选手荣誉">
      {majorsWon !== null ? (
        <li className="player-honors__item">
          <span aria-hidden="true">🏆</span>
          <strong>{Math.round(majorsWon)}</strong>
          <span>Major</span>
        </li>
      ) : null}
      {mvpCount !== null ? (
        <li className="player-honors__item">
          <span aria-hidden="true">🏅</span>
          <strong>{Math.round(mvpCount)}</strong>
          <span>MVP</span>
        </li>
      ) : null}
    </ul>
  );
}
