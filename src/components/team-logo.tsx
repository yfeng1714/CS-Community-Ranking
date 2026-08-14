import Image from "next/image";

export function TeamLogo({
  logoUrl,
  size = "medium",
}: {
  logoUrl: string | null;
  size?: "small" | "medium";
}) {
  if (!logoUrl) {
    return null;
  }

  return (
    <span aria-hidden="true" className="team-logo" data-size={size}>
      <Image alt="" className="team-logo__image" height={40} src={logoUrl} width={40} />
    </span>
  );
}
