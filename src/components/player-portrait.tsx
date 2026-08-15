import Image from "next/image";

const portraitSizes = {
  profile: "200px",
  ranking: "42px",
  vote: "112px",
} as const;

export function PlayerPortrait({
  nickname,
  photoUrl,
  priority = false,
  variant,
}: {
  nickname: string;
  photoUrl: string | null;
  priority?: boolean;
  variant: keyof typeof portraitSizes;
}) {
  return (
    <div
      className={`player-portrait player-portrait--${variant}`}
      data-placeholder={photoUrl ? "false" : "true"}
    >
      {photoUrl ? (
        <Image
          alt={`${nickname} 选手照片`}
          fill
          priority={priority}
          sizes={portraitSizes[variant]}
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
