import { countryFlagImageSrc } from "@/domain/public/country-flag";

export function CountryFlag({
  code,
  missingLabel = "国籍待补",
}: {
  code: string | null;
  missingLabel?: string;
}) {
  if (!code) {
    return <span className="country-flag country-flag--missing">{missingLabel}</span>;
  }

  const src = countryFlagImageSrc(code);
  const normalized = code.trim().toUpperCase();
  return (
    <span className="country-flag" title={normalized}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- local SVG flags
        <img alt="" aria-hidden="true" className="country-flag__image" src={src} />
      ) : (
        <span aria-hidden="true">{normalized}</span>
      )}
      <span className="sr-only">{normalized}</span>
    </span>
  );
}
