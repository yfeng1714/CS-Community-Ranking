export function PlayerHonors({
  majorsWon,
  mvpCount,
}: {
  majorsWon: number | null;
  mvpCount: number | null;
}) {
  return (
    <ul className="player-honors" aria-label="选手荣誉">
      <li className="player-honors__item">
        <span aria-hidden="true">🏆</span>
        <strong>{Math.round(majorsWon ?? 0)}</strong>
        <span>Major</span>
      </li>
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
