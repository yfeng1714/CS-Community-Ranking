import Image from "next/image";

export function PlayerPortrait({
  nickname,
  photoUrl,
  priority = false,
}: {
  nickname: string;
  photoUrl: string | null;
  priority?: boolean;
}) {
  return (
    <div className="player-portrait" data-placeholder={photoUrl ? "false" : "true"}>
      {photoUrl ? (
        <Image
          alt={`${nickname} 选手照片`}
          fill
          priority={priority}
          sizes="(max-width: 720px) 42vw, 360px"
          src={photoUrl}
        />
      ) : (
        <>
          <span aria-hidden="true" className="player-portrait__grid" />
          <span aria-hidden="true" className="player-portrait__monogram">
            {nickname.slice(0, 2).toUpperCase()}
          </span>
          <span className="sr-only">暂无 {nickname} 的可用照片</span>
        </>
      )}
    </div>
  );
}
